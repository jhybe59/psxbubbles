"""
Transformer Model for Market Intelligence
Learns long-range dependencies and context-aware patterns.

Uses attention to understand:
- Regime transitions
- Market state context
- Pattern relationships across time
"""
import math
import torch
import torch.nn as nn
import numpy as np
from typing import Optional
import structlog

logger = structlog.get_logger()


class PositionalEncoding(nn.Module):
    """Sinusoidal positional encoding for sequences."""
    
    def __init__(self, d_model: int, max_len: int = 500, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)  # (1, max_len, d_model)
        
        self.register_buffer('pe', pe)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.pe[:, :x.size(1)]
        return self.dropout(x)


class TransformerEncoder(nn.Module):
    """
    Transformer for market context learning.
    
    Architecture:
    - Input projection
    - Positional encoding
    - Multi-layer transformer encoder
    - Context aggregation
    - Multi-head output
    """
    
    def __init__(
        self,
        input_size: int,
        d_model: int = 128,
        nhead: int = 8,
        num_layers: int = 4,
        dim_feedforward: int = 256,
        dropout: float = 0.1,
        max_seq_len: int = 100
    ):
        super().__init__()
        
        self.d_model = d_model
        
        # Input projection
        self.input_proj = nn.Linear(input_size, d_model)
        
        # Positional encoding
        self.pos_encoder = PositionalEncoding(d_model, max_seq_len, dropout)
        
        # Transformer encoder layers
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        
        # Global context token (learnable)
        self.cls_token = nn.Parameter(torch.randn(1, 1, d_model))
        
        # Output heads
        self.prob_head = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )
        
        self.direction_head = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 3),
            nn.Softmax(dim=-1)
        )
        
        self.magnitude_head = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
            nn.ReLU()
        )
        
        self.confidence_head = nn.Sequential(
            nn.Linear(d_model, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
        
        # Regime classification (8 market states)
        self.regime_head = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.GELU(),
            nn.Linear(64, 8),
            nn.Softmax(dim=-1)
        )
    
    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> dict:
        """
        Forward pass.
        
        Args:
            x: (batch, seq_len, input_size)
            mask: Optional attention mask
            
        Returns:
            Dict with predictions
        """
        batch_size = x.size(0)
        
        # Project input
        x = self.input_proj(x)  # (batch, seq_len, d_model)
        
        # Add CLS token
        cls_tokens = self.cls_token.expand(batch_size, -1, -1)  # (batch, 1, d_model)
        x = torch.cat([cls_tokens, x], dim=1)  # (batch, seq_len+1, d_model)
        
        # Positional encoding
        x = self.pos_encoder(x)
        
        # Transformer
        x = self.transformer(x, src_key_padding_mask=mask)
        
        # Use CLS token output as context
        context = x[:, 0]  # (batch, d_model)
        
        # Multi-head outputs
        return {
            'probability': self.prob_head(context).squeeze(-1),
            'direction': self.direction_head(context),
            'magnitude': self.magnitude_head(context).squeeze(-1),
            'confidence': self.confidence_head(context).squeeze(-1),
            'regime': self.regime_head(context),
            'context_vector': context
        }


class TransformerTrainer:
    """Training wrapper for Transformer."""
    
    def __init__(
        self,
        model: TransformerEncoder,
        learning_rate: float = 0.0001,
        device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
    ):
        self.model = model.to(device)
        self.device = device
        
        self.optimizer = torch.optim.AdamW(
            model.parameters(), 
            lr=learning_rate,
            weight_decay=0.01
        )
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=100
        )
        
        self.prob_loss = nn.BCELoss()
        self.direction_loss = nn.CrossEntropyLoss()
        self.magnitude_loss = nn.MSELoss()
    
    def train_step(self, x, y_prob, y_direction, y_magnitude) -> dict:
        """Training step."""
        self.model.train()
        self.optimizer.zero_grad()
        
        x = x.to(self.device)
        y_prob = y_prob.to(self.device)
        y_direction = y_direction.to(self.device)
        y_magnitude = y_magnitude.to(self.device)
        
        outputs = self.model(x)
        
        loss_prob = self.prob_loss(outputs['probability'], y_prob)
        loss_dir = self.direction_loss(outputs['direction'], y_direction)
        loss_mag = self.magnitude_loss(outputs['magnitude'], y_magnitude)
        
        total_loss = 0.5 * loss_prob + 0.3 * loss_dir + 0.2 * loss_mag
        
        total_loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
        self.optimizer.step()
        
        return {
            'total_loss': total_loss.item(),
            'prob_loss': loss_prob.item(),
            'direction_loss': loss_dir.item()
        }
    
    def predict(self, x: torch.Tensor) -> dict:
        """Inference."""
        self.model.eval()
        
        with torch.no_grad():
            x = x.to(self.device)
            outputs = self.model(x)
            
            return {
                'probability': outputs['probability'].cpu().numpy(),
                'direction': outputs['direction'].argmax(dim=1).cpu().numpy() - 1,
                'magnitude': outputs['magnitude'].cpu().numpy(),
                'confidence': outputs['confidence'].cpu().numpy(),
                'regime': outputs['regime'].argmax(dim=1).cpu().numpy(),
                'regime_probs': outputs['regime'].cpu().numpy()
            }
    
    def save(self, path: str):
        torch.save({
            'model_state': self.model.state_dict(),
            'optimizer_state': self.optimizer.state_dict()
        }, path)
    
    def load(self, path: str):
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state'])


# Regime labels for reference
REGIME_LABELS = [
    'accumulation',
    'manipulation', 
    'expansion',
    'distribution',
    'chop',
    'trend',
    'mean_reversion',
    'breakout'
]
