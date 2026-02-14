"""
LSTM Model for Temporal Sequence Learning
Learns time-dependent patterns: pre-move structure, accumulation, compression.

Input: [t-n ... t] sequence of feature vectors
Output: P(move), direction, magnitude, confidence
"""
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from typing import Optional, Tuple
from pathlib import Path
import structlog

logger = structlog.get_logger()


class LSTMModel(nn.Module):
    """
    LSTM for market move prediction.
    
    Architecture:
    - Multi-layer LSTM with dropout
    - Attention mechanism for sequence weighting
    - Multi-head output (probability, direction, magnitude)
    """
    
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.3,
        bidirectional: bool = False
    ):
        super().__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        self.num_directions = 2 if bidirectional else 1
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional
        )
        
        # Attention layer
        self.attention = nn.Sequential(
            nn.Linear(hidden_size * self.num_directions, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1)
        )
        
        # Output heads
        combined_size = hidden_size * self.num_directions
        
        # Move probability (binary classification)
        self.prob_head = nn.Sequential(
            nn.Linear(combined_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )
        
        # Direction (-1, 0, 1) as classification
        self.direction_head = nn.Sequential(
            nn.Linear(combined_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 3),
            nn.Softmax(dim=-1)
        )
        
        # Magnitude (regression)
        self.magnitude_head = nn.Sequential(
            nn.Linear(combined_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.ReLU()  # Magnitude is positive
        )
        
        # Confidence (how sure the model is)
        self.confidence_head = nn.Sequential(
            nn.Linear(combined_size, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x: torch.Tensor) -> dict:
        """
        Forward pass.
        
        Args:
            x: Input tensor of shape (batch, seq_len, input_size)
            
        Returns:
            Dict with probability, direction, magnitude, confidence
        """
        # LSTM forward
        lstm_out, (h_n, c_n) = self.lstm(x)
        
        # --- LEGACY MODEL SUPPORT ---
        if hasattr(self, 'fc'):
            # Legacy model uses 'fc' head on the last hidden state
            # Shape: (batch, hidden_size)
            last_step = lstm_out[:, -1, :]
            prob = self.fc(last_step).squeeze(-1)
            
            # Return dict with defaults for missing heads
            return {
                'probability': prob,
                'direction': torch.zeros((x.size(0), 3), device=x.device),
                'magnitude': torch.zeros(x.size(0), device=x.device),
                'confidence': prob, # Use probability as proxy for confidence
                'attention_weights': torch.zeros((x.size(0), x.size(1)), device=x.device)
            }
        # ----------------------------

        # Attention weights (Optional for backward compatibility with newer models without attention)
        if hasattr(self, 'attention'):
            attn_weights = self.attention(lstm_out)  # (batch, seq_len, 1)
            attn_weights = torch.softmax(attn_weights, dim=1)
            
            # Weighted sum of LSTM outputs
            context = torch.sum(lstm_out * attn_weights, dim=1)  # (batch, hidden_size * num_directions)
        else:
            # Fallback: Use last time step
            context = lstm_out[:, -1, :]
            attn_weights = torch.zeros((x.size(0), x.size(1), 1), device=x.device)
        
        # Multi-head outputs
        prob = self.prob_head(context).squeeze(-1)  # (batch,)
        direction = self.direction_head(context)      # (batch, 3)
        magnitude = self.magnitude_head(context).squeeze(-1)  # (batch,)
        confidence = self.confidence_head(context).squeeze(-1)  # (batch,)
        
        return {
            'probability': prob,
            'direction': direction,
            'magnitude': magnitude,
            'confidence': confidence,
            'attention_weights': attn_weights.squeeze(-1)
        }


class LSTMTrainer:
    """
    Training wrapper for LSTM model.
    """
    
    def __init__(
        self,
        model: LSTMModel,
        learning_rate: float = 0.001,
        device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
    ):
        self.model = model.to(device)
        self.device = device
        
        self.optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)
        self.scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, mode='min', patience=5, factor=0.5
        )
        
        # Loss functions
        self.prob_loss = nn.BCELoss()
        self.direction_loss = nn.CrossEntropyLoss()
        self.magnitude_loss = nn.MSELoss()
    
    def train_step(
        self,
        x: torch.Tensor,
        y_prob: torch.Tensor,
        y_direction: torch.Tensor,
        y_magnitude: torch.Tensor
    ) -> dict:
        """Single training step."""
        self.model.train()
        self.optimizer.zero_grad()
        
        x = x.to(self.device)
        y_prob = y_prob.to(self.device)
        y_direction = y_direction.to(self.device)
        y_magnitude = y_magnitude.to(self.device)
        
        outputs = self.model(x)
        
        # Compute losses
        loss_prob = self.prob_loss(outputs['probability'], y_prob)
        loss_dir = self.direction_loss(outputs['direction'], y_direction)
        loss_mag = self.magnitude_loss(outputs['magnitude'], y_magnitude)
        
        # Combined loss (weighted)
        total_loss = 0.5 * loss_prob + 0.3 * loss_dir + 0.2 * loss_mag
        
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
        self.optimizer.step()
        
        return {
            'total_loss': total_loss.item(),
            'prob_loss': loss_prob.item(),
            'direction_loss': loss_dir.item(),
            'magnitude_loss': loss_mag.item()
        }
    
    def evaluate(
        self,
        x: torch.Tensor,
        y_prob: torch.Tensor,
        y_direction: torch.Tensor,
        y_magnitude: torch.Tensor
    ) -> dict:
        """Evaluation step."""
        self.model.eval()
        
        with torch.no_grad():
            x = x.to(self.device)
            y_prob = y_prob.to(self.device)
            y_direction = y_direction.to(self.device)
            y_magnitude = y_magnitude.to(self.device)
            
            outputs = self.model(x)
            
            # Losses
            loss_prob = self.prob_loss(outputs['probability'], y_prob)
            loss_dir = self.direction_loss(outputs['direction'], y_direction)
            loss_mag = self.magnitude_loss(outputs['magnitude'], y_magnitude)
            
            # Accuracy
            pred_prob = (outputs['probability'] > 0.5).float()
            prob_acc = (pred_prob == y_prob).float().mean()
            
            pred_dir = outputs['direction'].argmax(dim=1)
            dir_acc = (pred_dir == y_direction).float().mean()
        
        return {
            'prob_loss': loss_prob.item(),
            'direction_loss': loss_dir.item(),
            'magnitude_loss': loss_mag.item(),
            'prob_accuracy': prob_acc.item(),
            'direction_accuracy': dir_acc.item()
        }
    
    def predict(self, x: torch.Tensor) -> dict:
        """Inference."""
        self.model.eval()
        
        with torch.no_grad():
            x = x.to(self.device)
            outputs = self.model(x)
            
            return {
                'probability': outputs['probability'].cpu().numpy(),
                'direction': outputs['direction'].argmax(dim=1).cpu().numpy() - 1,  # Map to -1, 0, 1
                'magnitude': outputs['magnitude'].cpu().numpy(),
                'confidence': outputs['confidence'].cpu().numpy(),
                'attention': outputs['attention_weights'].cpu().numpy()
            }
    
    def save(self, path: str):
        """Save model."""
        torch.save({
            'model_state': self.model.state_dict(),
            'optimizer_state': self.optimizer.state_dict()
        }, path)
        logger.info("lstm_saved", path=path)
    
    def load(self, path: str):
        """Load model."""
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state'])
        logger.info("lstm_loaded", path=path)


def create_sequences(
    df: pd.DataFrame,
    feature_cols: list,
    label_cols: list,
    seq_length: int = 20
) -> Tuple[np.ndarray, dict]:
    """
    Create sequences for LSTM training.
    
    Returns:
        (X sequences, dict of y labels)
    """
    X = df[feature_cols].values
    
    sequences = []
    labels = {col: [] for col in label_cols}
    
    for i in range(len(X) - seq_length):
        seq = X[i:i + seq_length]
        sequences.append(seq)
        
        for col in label_cols:
            labels[col].append(df[col].iloc[i + seq_length])
    
    X_seq = np.array(sequences)
    y_dict = {col: np.array(vals) for col, vals in labels.items()}
    
    return X_seq, y_dict
