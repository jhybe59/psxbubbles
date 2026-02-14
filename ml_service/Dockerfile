FROM python:3.11-slim

WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=1000

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    git \
    cmake \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install PyTorch with CUDA support
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cu121

# Install core ML dependencies that xgboost/lightgbm need
RUN pip install --no-cache-dir numpy scipy

# Install xgboost WITHOUT its optional CUDA dependency (saves 290MB download that keeps corrupting)
RUN pip install --no-cache-dir --no-deps xgboost

# Install lightgbm normally
RUN pip install --no-cache-dir lightgbm

# Install scikit-learn
RUN pip install --no-cache-dir scikit-learn

# Install transformers
RUN pip install --no-cache-dir transformers

# Install remaining requirements
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Set environment variables
ENV ML_ENVIRONMENT=production
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Run service
CMD ["uvicorn", "inference:app", "--host", "0.0.0.0", "--port", "8000"]
