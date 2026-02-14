"""
Model Registry
Manages model versions, metadata, and deployment.

Features:
- Version tracking
- Model metadata storage
- Performance metrics
- Rollback support
- Canary deployment
"""
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import structlog

logger = structlog.get_logger()


@dataclass
class ModelMetadata:
    """Model version metadata."""
    version: str
    trained_on: str
    dataset: str
    model_type: str
    
    # Performance metrics
    metrics: Dict[str, float]
    
    # Regime-specific performance
    regime_performance: Dict[str, float]
    
    # File hashes for integrity
    file_hashes: Dict[str, str]
    
    # Deployment info
    deployed: bool = False
    deployed_at: Optional[str] = None
    is_active: bool = False
    
    # Notes
    notes: str = ""


class ModelRegistry:
    """
    Registry for managing model versions.
    """
    
    def __init__(self, registry_path: str = "models/registry"):
        self.registry_path = Path(registry_path)
        self.registry_path.mkdir(parents=True, exist_ok=True)
        
        self.metadata_file = self.registry_path / "registry.json"
        self.versions: Dict[str, ModelMetadata] = {}
        
        self._load_registry()
    
    def _load_registry(self) -> None:
        """Load registry from disk."""
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r') as f:
                data = json.load(f)
                for version, meta in data.items():
                    self.versions[version] = ModelMetadata(**meta)
            logger.info("registry_loaded", versions=len(self.versions))
    
    def _save_registry(self) -> None:
        """Save registry to disk."""
        data = {v: asdict(m) for v, m in self.versions.items()}
        with open(self.metadata_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def register_model(
        self,
        version: str,
        model_files: Dict[str, Path],
        metrics: Dict[str, float],
        regime_performance: Dict[str, float],
        dataset: str,
        model_type: str = "ensemble",
        notes: str = ""
    ) -> ModelMetadata:
        """
        Register a new model version.
        
        Args:
            version: Version string (e.g., "1.2.0")
            model_files: Dict of model name -> file path
            metrics: Overall performance metrics
            regime_performance: Performance by regime
            dataset: Dataset used for training
            model_type: Type of model
            notes: Optional notes
        """
        # Create version directory
        version_dir = self.registry_path / version
        version_dir.mkdir(exist_ok=True)
        
        # Copy model files
        file_hashes = {}
        for name, path in model_files.items():
            if path.exists():
                dest = version_dir / path.name
                shutil.copy2(path, dest)
                file_hashes[name] = self._hash_file(dest)
        
        # Create metadata
        metadata = ModelMetadata(
            version=version,
            trained_on=datetime.now().isoformat(),
            dataset=dataset,
            model_type=model_type,
            metrics=metrics,
            regime_performance=regime_performance,
            file_hashes=file_hashes,
            notes=notes
        )
        
        # Save metadata
        with open(version_dir / "metadata.json", 'w') as f:
            json.dump(asdict(metadata), f, indent=2)
        
        self.versions[version] = metadata
        self._save_registry()
        
        logger.info("model_registered", version=version)
        return metadata
    
    def get_active_version(self) -> Optional[str]:
        """Get the currently active model version."""
        for version, meta in self.versions.items():
            if meta.is_active:
                return version
        return None
    
    def activate_version(self, version: str) -> bool:
        """Activate a model version for production."""
        if version not in self.versions:
            logger.warning("version_not_found", version=version)
            return False
        
        # Deactivate all
        for v in self.versions.values():
            v.is_active = False
        
        # Activate requested
        self.versions[version].is_active = True
        self.versions[version].deployed = True
        self.versions[version].deployed_at = datetime.now().isoformat()
        
        self._save_registry()
        logger.info("version_activated", version=version)
        return True
    
    def rollback(self, to_version: str) -> bool:
        """Rollback to a previous version."""
        return self.activate_version(to_version)
    
    def get_version_path(self, version: str) -> Optional[Path]:
        """Get path to version directory."""
        if version not in self.versions:
            return None
        return self.registry_path / version
    
    def list_versions(self) -> List[Dict]:
        """List all versions with key info."""
        return [
            {
                'version': v,
                'trained_on': m.trained_on,
                'is_active': m.is_active,
                'f1': m.metrics.get('f1', 0),
                'notes': m.notes
            }
            for v, m in sorted(self.versions.items(), reverse=True)
        ]
    
    def compare_versions(self, v1: str, v2: str) -> Dict:
        """Compare two versions."""
        if v1 not in self.versions or v2 not in self.versions:
            return {}
        
        m1, m2 = self.versions[v1], self.versions[v2]
        
        return {
            'versions': [v1, v2],
            'metric_diff': {
                k: m2.metrics.get(k, 0) - m1.metrics.get(k, 0)
                for k in set(m1.metrics) | set(m2.metrics)
            },
            'regime_diff': {
                k: m2.regime_performance.get(k, 0) - m1.regime_performance.get(k, 0)
                for k in set(m1.regime_performance) | set(m2.regime_performance)
            }
        }
    
    def _hash_file(self, path: Path) -> str:
        """Compute file hash for integrity."""
        import hashlib
        hasher = hashlib.sha256()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()[:16]


# Global registry
model_registry = ModelRegistry()
