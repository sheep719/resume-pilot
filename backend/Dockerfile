FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
# docker 内默认为国际 pypi；国内云服务器用腾讯云镜像源（本地构建不受影响，
# 腾讯云镜像站境内/境外均可用）
ARG PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
RUN pip install --no-cache-dir -i "$PIP_INDEX_URL" -r requirements.txt

COPY app/ ./app/
COPY tools/ ./tools/

# SQLite 数据卷挂载点
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
