"""
CNN for Time Series Pattern Recognition
Learns microstructure patterns in tick/volume/price data.

Specialized for:
- Tick structure patterns
- Volume spike detection
- Order flow patterns
- Micro price movements
"""
import torch
import torch.nn as nn
import numpy as np
from typing import Optional
import structlog

logger = structlog.get_logger()


class CNNTimeSeries(nn.Module):
    """
    1D CNN for time series pattern recognition.
    
    Architecture:
    - Multi-scale convolutional filters (different pattern lengths)
    - Dilated convolutions for larger receptive field
    - Global pooling for fixed-size output
    - Multi-head predictions
    """
    
    def __init__(
        self,
        input_channels: int,
        hidden_channels: int = 64,
        kernel_sizes: tuple = (3, 5, 7, 11),
        dropout: float = 0.3
    ):
        super().__init__()
        
        # Multi-scale convolution branches
        self.conv_branches = nn.ModuleList()
        
        for kernel_size in kernel_sizes:
            branch = nn.Sequential(
                nn.Conv1d(input_channels, hidden_channels, kernel_size=kernel_size, padding=kernel_size//2),
                nn.BatchNorm1d(hidden_channels),
                nn.ReLU(),
                nn.Conv1d(hidden_channels, hidden_channels, kernel_size=kernel_size, padding=kernel_size//2, dilation=2),
                nn.BatchNorm1d(hidden_channels),
                nn.ReLU(),
                nn.AdaptiveMaxPool1d(1)  # Global max pooling
            )
            self.conv_branches.append(branch)
        
        # Combine all branches
        combined_size = hidden_channels * len(kernel_sizes)
        
        # Fusion layer
        self.fusion = nn.Sequential(
            nn.Linear(combined_size, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, 64),
            nn.ReLU()
        )
        
        # Output heads
        self.prob_head = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
        
        self.direction_head = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 3),
            nn.Softmax(dim=-1)
        )
        
        self.pattern_head = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 6),  # 6 microstructure patterns
            nn.Softmax(dim=-1)
        )
        
        self.confidence_head = nn.Sequential(
            nn.Linear(64, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x: torch.Tensor) -> dict:
        """
        Forward pass.
        
        Args:
            x: (batch, seq_len, channels) - will be transposed for Conv1d
            
        Returns:
            Dict with predictions
        """
        # Transpose for Conv1d: (batch, channels, seq_len)
        x = x.transpose(1, 2)
        
        # Process each scale
        branch_outputs = []
        for branch in self.conv_branches:
            out = branch(x).squeeze(-1)  # (batch, hidden_channels)
            branch_outputs.append(out)
        
        # Concatenate
        combined = torch.cat(branch_outputs, dim=1)  # (batch, combined_size)
        
        # Fusion
        features = self.fusion(combined)
        
        return {
            'probability': self.prob_head(features).squeeze(-1),
            'direction': self.direction_head(features),
            'pattern': self.pattern_head(features),
            'confidence': self.confidence_head(features).squeeze(-1),
            'features': features
        }


class CNNTrainer:
    """Training wrapper for CNN model."""
    
    def __init__(
        self,
        model: CNNTimeSeries,
        learning_rate: float = 0.001,
        device: str = 'cuda' if torch.cuda.is_available() else 'cpu'
    ):
        self.model = model.to(device)
        self.device = device
        
        self.optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)
        self.prob_loss = nn.BCELoss()
        self.direction_loss = nn.CrossEntropyLoss()
    
    def train_step(self, x, y_prob, y_direction) -> dict:
        self.model.train()
        self.optimizer.zero_grad()
        
        x = x.to(self.device)
        y_prob = y_prob.to(self.device)
        y_direction = y_direction.to(self.device)
        
        outputs = self.model(x)
        
        loss_prob = self.prob_loss(outputs['probability'], y_prob)
        loss_dir = self.direction_loss(outputs['direction'], y_direction)
        
        total_loss = 0.6 * loss_prob + 0.4 * loss_dir
        
        total_loss.backward()
        self.optimizer.step()
        
        return {'total_loss': total_loss.item()}
    
    def predict(self, x: torch.Tensor) -> dict:
        self.model.eval()
        
        with torch.no_grad():
            x = x.to(self.device)
            outputs = self.model(x)
            
            return {
                'probability': outputs['probability'].cpu().numpy(),
                'direction': outputs['direction'].argmax(dim=1).cpu().numpy() - 1,
                'pattern': outputs['pattern'].argmax(dim=1).cpu().numpy(),
                'pattern_probs': outputs['pattern'].cpu().numpy(),
                'confidence': outputs['confidence'].cpu().numpy()
            }
    
    def save(self, path: str):
        torch.save({'model_state': self.model.state_dict()}, path)
    
    def load(self, path: str):
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state'])


# Pattern labels
PATTERN_LABELS = [
    'absorption',      # Large volume absorbed without move
    'breakout_setup',  # Compression with volume buildup
    'exhaustion',      # High volume at extreme
    'momentum',        # Strong directional flow
    'reversal',        # Volume divergence from price
    'accumulation'     # Steady volume accumulation
]
