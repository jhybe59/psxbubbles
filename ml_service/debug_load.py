import pickle
import sys
import torch
from pathlib import Path
from deep_models.lstm_model import LSTMModel

with open("/app/debug_output.txt", "w") as out:
    path = Path("/app/models/lstm_deep_v1.pkl")
    out.write(f"Checking path: {path.absolute()}\n")
    if not path.exists():
        out.write("Path does not exist!\n")
        sys.exit(1)

    out.write(f"Path exists. Size: {path.stat().st_size}\n")
    try:
        # Fix for pickle namespace issue (saved as __main__.LSTMModel)
        import sys
        if not hasattr(sys.modules['__main__'], 'LSTMModel'):
            sys.modules['__main__'].LSTMModel = LSTMModel
            
        out.write("Attempting pickle load...\n")
        with open(path, 'rb') as f:
            model = pickle.load(f)
        out.write(f"Loaded object type: {type(model)}\n")
        out.write(f"Model attributes: {dir(model)}\n")
        out.write(f"Model structure:\n{model}\n")
        out.write("Success!\n")
    except Exception as e:
        out.write(f"Failed: {e}\n")
        import traceback
        traceback.print_exc(file=out)
