FROM python:3.11-slim

WORKDIR /app

# Install uv for faster dependency management
RUN pip install --no-cache-dir uv

# Copy dependency files
COPY pyproject.toml .

# Install dependencies
RUN uv pip install --system -r pyproject.toml

# Copy application code
COPY . .

# Expose port
EXPOSE 8923

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8923"]
