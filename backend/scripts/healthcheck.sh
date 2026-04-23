#!/bin/bash
curl -f http://localhost:${PORT:-8000}/api/v1/health || exit 1
