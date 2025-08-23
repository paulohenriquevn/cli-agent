# 🚀 Production Deployment Guide - LLM Agent System

## 📋 **Visão Geral**

Este guia fornece instruções completas para deployment, scaling, monitoramento e manutenção do sistema LLM Agent em ambiente de produção, cobrindo desde configuração de infraestrutura até estratégias de alta disponibilidade.

## 🏗️ **Architecture Overview**

### **Production Architecture Diagram**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   API Gateway   │    │   Monitoring    │
│    (Nginx/AWS)  │───▶│  (Kong/Traefik) │───▶│  (Grafana/DD)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Agent Instance │    │  Agent Instance │    │  Agent Instance │
│     (Node.js)   │    │     (Node.js)   │    │     (Node.js)   │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Agent        │ │    │ │Agent        │ │    │ │Agent        │ │
│ │Controller   │ │    │ │Controller   │ │    │ │Controller   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Memory       │ │    │ │Memory       │ │    │ │Memory       │ │
│ │Manager      │ │    │ │Manager      │ │    │ │Manager      │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Redis Cluster │    │ Vector Database │    │  File Storage   │
│  (Session/Cache)│    │  (Pinecone/Weaviate)│  (S3/MinIO)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Docker        │    │   OpenRouter    │
│   (Metadata)    │    │   Registry      │    │   API Gateway   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🐳 **Docker Configuration**

### **Multi-Stage Dockerfile**
```dockerfile
# Production Dockerfile
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine as production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S agent -u 1001

WORKDIR /app

# Copy production files
COPY --from=builder --chown=agent:nodejs /app/dist ./dist
COPY --from=builder --chown=agent:nodejs /app/node_modules ./node_modules
COPY --chown=agent:nodejs package*.json ./

# Security: Remove unnecessary files
RUN rm -rf /tmp/* /var/cache/apk/*

# Switch to non-root user
USER agent

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
```

### **Docker Compose for Development**
```yaml
# docker-compose.yml
version: '3.8'

services:
  agent:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - REDIS_URL=redis://redis:6379
      - POSTGRES_URL=postgresql://postgres:password@postgres:5432/agent
      - VECTOR_DB_URL=http://weaviate:8080
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock  # For sandbox
    depends_on:
      - redis
      - postgres
      - weaviate
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=agent
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped

  weaviate:
    image: semitechnologies/weaviate:1.21.0
    ports:
      - "8080:8080"
    environment:
      - QUERY_DEFAULTS_LIMIT=25
      - AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true
      - PERSISTENCE_DATA_PATH=/var/lib/weaviate
      - DEFAULT_VECTORIZER_MODULE=none
      - ENABLE_MODULES=text2vec-openai
    volumes:
      - weaviate_data:/var/lib/weaviate
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
  weaviate_data:
```

## ☸️ **Kubernetes Deployment**

### **Agent Deployment**
```yaml
# k8s/agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-agent
  labels:
    app: llm-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-agent
  template:
    metadata:
      labels:
        app: llm-agent
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: agent
        image: your-registry/llm-agent:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: OPENROUTER_API_KEY
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: openrouter-api-key
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: POSTGRES_URL
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: postgres-url
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: data-storage
          mountPath: /app/data
        - name: docker-socket
          mountPath: /var/run/docker.sock
      volumes:
      - name: data-storage
        persistentVolumeClaim:
          claimName: agent-data-pvc
      - name: docker-socket
        hostPath:
          path: /var/run/docker.sock
          type: Socket
---
apiVersion: v1
kind: Service
metadata:
  name: agent-service
spec:
  selector:
    app: llm-agent
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
---
apiVersion: v1
kind: Secret
metadata:
  name: agent-secrets
type: Opaque
stringData:
  openrouter-api-key: "your-openrouter-api-key"
  postgres-url: "postgresql://username:password@postgres-service:5432/agent"
```

### **Horizontal Pod Autoscaler**
```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: llm-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: llm-agent
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
```

## 🔒 **Security Configuration**

### **Production Security Setup**
```typescript
// src/config/security.production.ts
export const productionSecurityConfig: SecurityConfiguration = {
  // API Security
  api: {
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }
  },

  // Agent Security
  agent: {
    sandbox: {
      enabled: true,
      dockerImage: 'your-registry/secure-runtime:latest',
      resourceLimits: {
        memory: '512m',
        cpu: '500m',
        disk: '1g',
        networkBandwidth: '10m'
      },
      capabilities: {
        drop: ['ALL'],
        add: ['CHOWN', 'DAC_OVERRIDE', 'SETUID', 'SETGID']
      },
      readOnlyRootFilesystem: true,
      allowPrivilegeEscalation: false
    },
    
    fileAccess: {
      allowedDirectories: [
        '/app/workspace',
        '/tmp/agent-workspace'
      ],
      blockedFiles: [
        '.env',
        '*.key',
        '*.pem',
        '/etc/passwd',
        '/etc/shadow'
      ],
      maxFileSize: 100 * 1024 * 1024, // 100MB
      quarantineEnabled: true
    },

    commandExecution: {
      allowedCommands: [
        'npm', 'node', 'python3', 'pip3',
        'git', 'curl', 'wget',
        'ls', 'cat', 'grep', 'find'
      ],
      blockedPatterns: [
        /rm\s+-rf\s+/,
        /sudo\s+/,
        /chmod\s+777/,
        />\s*\/dev\/null/,
        /\|\s*bash/,
        /eval\s*\(/,
        /exec\s*\(/
      ],
      timeoutMs: 300000, // 5 minutes
      logAllCommands: true
    }
  },

  // Data Encryption
  encryption: {
    atRest: {
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90
    },
    inTransit: {
      minTlsVersion: '1.2',
      cipherSuites: [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256'
      ]
    }
  },

  // Authentication & Authorization
  auth: {
    jwt: {
      algorithm: 'RS256',
      expiresIn: '1h',
      issuer: 'llm-agent-system',
      audience: 'agent-users'
    },
    apiKeys: {
      required: true,
      rotationDays: 30,
      scopedPermissions: true
    }
  }
};
```

### **Network Security**
```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-network-policy
spec:
  podSelector:
    matchLabels:
      app: llm-agent
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443  # HTTPS for OpenRouter API
    - protocol: TCP
      port: 6379  # Redis
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 8080  # Vector DB
  - to: []
    ports:
    - protocol: UDP
      port: 53   # DNS
```

## 📊 **Monitoring & Observability**

### **Prometheus Metrics**
```typescript
// src/monitoring/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

export class AgentMetrics {
  private static instance: AgentMetrics;

  // Counters
  public readonly requestsTotal = new Counter({
    name: 'agent_requests_total',
    help: 'Total number of requests processed',
    labelNames: ['method', 'status', 'user_id']
  });

  public readonly toolExecutionsTotal = new Counter({
    name: 'agent_tool_executions_total', 
    help: 'Total number of tool executions',
    labelNames: ['tool_name', 'status', 'user_id']
  });

  public readonly llmRequestsTotal = new Counter({
    name: 'agent_llm_requests_total',
    help: 'Total number of LLM API requests',
    labelNames: ['model', 'provider', 'status']
  });

  // Histograms
  public readonly requestDuration = new Histogram({
    name: 'agent_request_duration_seconds',
    help: 'Request duration in seconds',
    labelNames: ['method', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
  });

  public readonly toolExecutionDuration = new Histogram({
    name: 'agent_tool_execution_duration_seconds',
    help: 'Tool execution duration in seconds', 
    labelNames: ['tool_name', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
  });

  public readonly llmResponseTime = new Histogram({
    name: 'agent_llm_response_time_seconds',
    help: 'LLM API response time in seconds',
    labelNames: ['model', 'provider'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60]
  });

  // Gauges
  public readonly activeSessions = new Gauge({
    name: 'agent_active_sessions',
    help: 'Number of active agent sessions'
  });

  public readonly memoryUsage = new Gauge({
    name: 'agent_memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['type']
  });

  public readonly costSpent = new Gauge({
    name: 'agent_cost_spent_dollars',
    help: 'Total cost spent in dollars',
    labelNames: ['period', 'user_id']
  });

  private constructor() {
    register.registerMetric(this.requestsTotal);
    register.registerMetric(this.toolExecutionsTotal);
    register.registerMetric(this.llmRequestsTotal);
    register.registerMetric(this.requestDuration);
    register.registerMetric(this.toolExecutionDuration);
    register.registerMetric(this.llmResponseTime);
    register.registerMetric(this.activeSessions);
    register.registerMetric(this.memoryUsage);
    register.registerMetric(this.costSpent);
  }

  public static getInstance(): AgentMetrics {
    if (!AgentMetrics.instance) {
      AgentMetrics.instance = new AgentMetrics();
    }
    return AgentMetrics.instance;
  }

  public recordRequest(method: string, status: string, userId: string, duration: number): void {
    this.requestsTotal.inc({ method, status, user_id: userId });
    this.requestDuration.observe({ method, status }, duration);
  }

  public recordToolExecution(
    toolName: string, 
    status: string, 
    userId: string, 
    duration: number
  ): void {
    this.toolExecutionsTotal.inc({ tool_name: toolName, status, user_id: userId });
    this.toolExecutionDuration.observe({ tool_name: toolName, status }, duration);
  }
}
```

### **Health Checks**
```typescript
// src/monitoring/health.ts
export class HealthChecker {
  private checks: Map<string, HealthCheck> = new Map();

  constructor() {
    this.registerChecks();
  }

  private registerChecks(): void {
    // Database connectivity
    this.checks.set('database', {
      name: 'Database Connection',
      check: async () => {
        try {
          await this.postgres.query('SELECT 1');
          return { status: 'healthy', message: 'Database connection OK' };
        } catch (error) {
          return { status: 'unhealthy', message: `Database error: ${error.message}` };
        }
      },
      timeout: 5000
    });

    // Redis connectivity
    this.checks.set('redis', {
      name: 'Redis Connection',
      check: async () => {
        try {
          await this.redis.ping();
          return { status: 'healthy', message: 'Redis connection OK' };
        } catch (error) {
          return { status: 'unhealthy', message: `Redis error: ${error.message}` };
        }
      },
      timeout: 5000
    });

    // OpenRouter API
    this.checks.set('openrouter', {
      name: 'OpenRouter API',
      check: async () => {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'HTTP-Referer': 'https://github.com/your-org/llm-agent',
              'X-Title': 'LLM Agent Health Check'
            }
          });

          if (response.ok) {
            return { status: 'healthy', message: 'OpenRouter API accessible' };
          } else {
            return { status: 'unhealthy', message: `OpenRouter API error: ${response.status}` };
          }
        } catch (error) {
          return { status: 'unhealthy', message: `OpenRouter API error: ${error.message}` };
        }
      },
      timeout: 10000
    });

    // Vector database
    this.checks.set('vectordb', {
      name: 'Vector Database',
      check: async () => {
        try {
          const response = await fetch(`${process.env.VECTOR_DB_URL}/v1/meta`);
          if (response.ok) {
            return { status: 'healthy', message: 'Vector database OK' };
          } else {
            return { status: 'unhealthy', message: `Vector DB error: ${response.status}` };
          }
        } catch (error) {
          return { status: 'unhealthy', message: `Vector DB error: ${error.message}` };
        }
      },
      timeout: 5000
    });

    // Memory usage
    this.checks.set('memory', {
      name: 'Memory Usage',
      check: async () => {
        const used = process.memoryUsage();
        const totalMB = Math.round(used.rss / 1024 / 1024);
        const heapMB = Math.round(used.heapUsed / 1024 / 1024);
        
        if (totalMB > 2048) { // 2GB limit
          return { 
            status: 'warning', 
            message: `High memory usage: ${totalMB}MB RSS, ${heapMB}MB heap` 
          };
        }
        
        return { 
          status: 'healthy', 
          message: `Memory usage: ${totalMB}MB RSS, ${heapMB}MB heap` 
        };
      },
      timeout: 1000
    });
  }

  async runHealthCheck(): Promise<HealthStatus> {
    const results: HealthCheckResult[] = [];
    let overallStatus: 'healthy' | 'warning' | 'unhealthy' = 'healthy';

    for (const [key, check] of this.checks.entries()) {
      try {
        const result = await Promise.race([
          check.check(),
          this.timeout(check.timeout, `Health check timeout: ${check.name}`)
        ]);

        results.push({
          name: check.name,
          ...result,
          timestamp: new Date().toISOString()
        });

        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'warning' && overallStatus === 'healthy') {
          overallStatus = 'warning';
        }
      } catch (error) {
        results.push({
          name: check.name,
          status: 'unhealthy',
          message: error.message,
          timestamp: new Date().toISOString()
        });
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results,
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  private timeout<T>(ms: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }
}
```

### **Grafana Dashboard Configuration**
```json
{
  "dashboard": {
    "title": "LLM Agent System",
    "panels": [
      {
        "title": "Request Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(agent_requests_total[5m])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph", 
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(agent_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(agent_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Tool Execution Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(agent_tool_executions_total{status=\"success\"}[5m]) / rate(agent_tool_executions_total[5m]) * 100",
            "legendFormat": "Success Rate %"
          }
        ]
      },
      {
        "title": "LLM API Costs",
        "type": "graph",
        "targets": [
          {
            "expr": "increase(agent_cost_spent_dollars[1h])",
            "legendFormat": "{{user_id}}"
          }
        ]
      },
      {
        "title": "Active Sessions",
        "type": "stat",
        "targets": [
          {
            "expr": "agent_active_sessions",
            "legendFormat": "Sessions"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "agent_memory_usage_bytes{type=\"heap\"} / 1024 / 1024",
            "legendFormat": "Heap (MB)"
          },
          {
            "expr": "agent_memory_usage_bytes{type=\"rss\"} / 1024 / 1024", 
            "legendFormat": "RSS (MB)"
          }
        ]
      }
    ]
  }
}
```

## 🔄 **Backup & Disaster Recovery**

### **Automated Backup Strategy**
```bash
#!/bin/bash
# scripts/backup.sh

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/backups/agent_system_${TIMESTAMP}"
S3_BUCKET="s3://your-backup-bucket/agent-backups"

echo "Starting backup process at $(date)"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
pg_dump "$POSTGRES_URL" > "$BACKUP_DIR/postgres_backup.sql"

# Backup Redis snapshots
echo "Backing up Redis..."
redis-cli --rdb "$BACKUP_DIR/redis_backup.rdb"

# Backup vector database
echo "Backing up vector database..."
curl -X POST "$VECTOR_DB_URL/v1/schema/backup" > "$BACKUP_DIR/vector_schema.json"

# Backup application data
echo "Backing up application data..."
tar -czf "$BACKUP_DIR/app_data.tar.gz" /app/data

# Backup configurations
echo "Backing up configurations..."
cp -r /app/config "$BACKUP_DIR/"

# Create manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "version": "$(cat /app/package.json | jq -r .version)",
  "components": {
    "postgres": "postgres_backup.sql",
    "redis": "redis_backup.rdb", 
    "vector_db": "vector_schema.json",
    "app_data": "app_data.tar.gz",
    "config": "config/"
  },
  "size_mb": $(du -sm "$BACKUP_DIR" | cut -f1)
}
EOF

# Compress entire backup
echo "Compressing backup..."
tar -czf "${BACKUP_DIR}.tar.gz" -C /backups "agent_system_${TIMESTAMP}"

# Upload to S3
echo "Uploading to S3..."
aws s3 cp "${BACKUP_DIR}.tar.gz" "$S3_BUCKET/agent_system_${TIMESTAMP}.tar.gz"

# Cleanup local backup (keep only compressed version)
rm -rf "$BACKUP_DIR"

# Cleanup old backups (keep last 30 days)
find /backups -name "agent_system_*.tar.gz" -mtime +30 -delete

echo "Backup completed successfully at $(date)"
```

### **Disaster Recovery Procedure**
```bash
#!/bin/bash
# scripts/restore.sh

set -e

if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup_timestamp>"
    echo "Example: $0 20241201_143000"
    exit 1
fi

BACKUP_TIMESTAMP="$1"
BACKUP_FILE="agent_system_${BACKUP_TIMESTAMP}.tar.gz"
S3_BUCKET="s3://your-backup-bucket/agent-backups"
RESTORE_DIR="/tmp/restore_${BACKUP_TIMESTAMP}"

echo "Starting disaster recovery for backup: $BACKUP_TIMESTAMP"

# Download backup from S3
echo "Downloading backup from S3..."
aws s3 cp "${S3_BUCKET}/${BACKUP_FILE}" "/tmp/${BACKUP_FILE}"

# Extract backup
echo "Extracting backup..."
mkdir -p "$RESTORE_DIR"
tar -xzf "/tmp/${BACKUP_FILE}" -C "$RESTORE_DIR"

# Verify backup integrity
echo "Verifying backup integrity..."
if [ ! -f "$RESTORE_DIR/agent_system_${BACKUP_TIMESTAMP}/manifest.json" ]; then
    echo "Error: Backup manifest not found!"
    exit 1
fi

# Stop current services
echo "Stopping current services..."
docker-compose down

# Restore PostgreSQL
echo "Restoring PostgreSQL..."
psql "$POSTGRES_URL" < "$RESTORE_DIR/agent_system_${BACKUP_TIMESTAMP}/postgres_backup.sql"

# Restore Redis
echo "Restoring Redis..."
redis-cli --pipe < "$RESTORE_DIR/agent_system_${BACKUP_TIMESTAMP}/redis_backup.rdb"

# Restore vector database
echo "Restoring vector database..."
curl -X POST "$VECTOR_DB_URL/v1/schema/restore" -d @"$RESTORE_DIR/agent_system_${BACKUP_TIMESTAMP}/vector_schema.json"

# Restore application data
echo "Restoring application data..."
rm -rf /app/data
tar -xzf "$RESTORE_DIR/agent_system_${BACKUP_TIMESTAMP}/app_data.tar.gz" -C /

# Restore configurations
echo "Restoring configurations..."
cp -r "$RESTORE_DIR/agent_system_${BACKUP_TIMESTAMP}/config" /app/

# Start services
echo "Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 30

# Verify system health
echo "Verifying system health..."
curl -f http://localhost:3000/health || {
    echo "Error: System health check failed!"
    exit 1
}

# Cleanup
rm -rf "$RESTORE_DIR"
rm "/tmp/${BACKUP_FILE}"

echo "Disaster recovery completed successfully!"
echo "System restored from backup: $BACKUP_TIMESTAMP"
```

## ⚖️ **Load Balancing & High Availability**

### **Nginx Configuration**
```nginx
# nginx/nginx.conf
upstream agent_backend {
    least_conn;
    
    server agent-1:3000 max_fails=3 fail_timeout=30s;
    server agent-2:3000 max_fails=3 fail_timeout=30s;
    server agent-3:3000 max_fails=3 fail_timeout=30s;
    
    # Health check
    keepalive 32;
}

server {
    listen 80;
    server_name your-agent-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-agent-domain.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/agent.crt;
    ssl_certificate_key /etc/ssl/private/agent.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Proxy configuration
    location / {
        proxy_pass http://agent_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s; # 5 minutes for long-running tasks
    }
    
    # Health check endpoint (no rate limiting)
    location /health {
        access_log off;
        proxy_pass http://agent_backend;
        proxy_connect_timeout 1s;
        proxy_send_timeout 1s;
        proxy_read_timeout 1s;
    }
    
    # Static files
    location /static/ {
        alias /var/www/static/;
        expires 1d;
        add_header Cache-Control "public, no-transform";
    }
    
    # Logging
    access_log /var/log/nginx/agent_access.log combined;
    error_log /var/log/nginx/agent_error.log warn;
}
```

## 📈 **Performance Optimization**

### **Connection Pooling & Caching**
```typescript
// src/config/database.production.ts
import { Pool } from 'pg';
import Redis from 'ioredis';

export const createProductionDatabases = () => {
  // PostgreSQL connection pool
  const pgPool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 20, // Maximum number of connections
    min: 5,  // Minimum number of connections
    idle: 10000, // Close idle connections after 10s
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000,
    query_timeout: 30000,
    application_name: 'llm-agent-system'
  });

  // Redis cluster for caching
  const redis = new Redis.Cluster([
    { host: 'redis-1', port: 6379 },
    { host: 'redis-2', port: 6379 },
    { host: 'redis-3', port: 6379 }
  ], {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keyPrefix: 'agent:',
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
      db: 0,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      family: 4,
      keepAlive: true,
      lazyConnect: true
    }
  });

  // Session store (separate Redis instance)
  const sessionRedis = new Redis({
    host: process.env.SESSION_REDIS_HOST || 'session-redis',
    port: parseInt(process.env.SESSION_REDIS_PORT || '6379'),
    password: process.env.SESSION_REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });

  return { pgPool, redis, sessionRedis };
};
```

### **Memory Optimization**
```typescript
// src/utils/memoryOptimizer.ts
export class MemoryOptimizer {
  private gcInterval: NodeJS.Timeout;
  private metrics = AgentMetrics.getInstance();

  constructor() {
    this.setupGarbageCollection();
    this.setupMemoryMonitoring();
  }

  private setupGarbageCollection(): void {
    // Force garbage collection every 5 minutes
    this.gcInterval = setInterval(() => {
      if (global.gc) {
        const before = process.memoryUsage();
        global.gc();
        const after = process.memoryUsage();
        
        const freedMB = Math.round((before.heapUsed - after.heapUsed) / 1024 / 1024);
        
        if (freedMB > 10) {
          console.log(`Garbage collection freed ${freedMB}MB`);
        }
      }
    }, 5 * 60 * 1000);
  }

  private setupMemoryMonitoring(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      
      this.metrics.memoryUsage.set({ type: 'rss' }, usage.rss);
      this.metrics.memoryUsage.set({ type: 'heap_total' }, usage.heapTotal);
      this.metrics.memoryUsage.set({ type: 'heap_used' }, usage.heapUsed);
      this.metrics.memoryUsage.set({ type: 'external' }, usage.external);

      // Alert if memory usage is too high
      const rssGB = usage.rss / (1024 * 1024 * 1024);
      if (rssGB > 1.8) { // Alert at 1.8GB (before 2GB limit)
        console.warn(`High memory usage: ${rssGB.toFixed(2)}GB RSS`);
      }
    }, 30000); // Every 30 seconds
  }

  cleanup(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
  }
}
```

## 🚦 **CI/CD Pipeline**

### **GitHub Actions Workflow**
```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint:check
    
    - name: Run type checking
      run: npm run typecheck
    
    - name: Run tests
      run: npm test -- --coverage
      env:
        NODE_ENV: test
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3

  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Run security audit
      run: npm audit --audit-level=moderate
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to Kubernetes
      uses: azure/k8s-deploy@v1
      with:
        manifests: |
          k8s/agent-deployment.yaml
          k8s/hpa.yaml
        images: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:main-${{ github.sha }}
        kubeconfig: ${{ secrets.KUBE_CONFIG }}
    
    - name: Verify deployment
      run: |
        kubectl rollout status deployment/llm-agent
        kubectl get pods -l app=llm-agent
    
    - name: Run smoke tests
      run: |
        # Wait for deployment to be ready
        sleep 60
        
        # Test health endpoint
        curl -f https://your-agent-domain.com/health
        
        # Test basic functionality
        curl -X POST https://your-agent-domain.com/api/v1/chat \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer ${{ secrets.API_KEY }}" \
          -d '{"message": "Hello, test the system"}'

  notify:
    needs: [deploy]
    runs-on: ubuntu-latest
    if: always()
    
    steps:
    - name: Notify Slack
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#deployments'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
      if: always()
```

## 📊 **Cost Management**

### **Cost Monitoring & Alerting**
```typescript
// src/monitoring/costMonitor.ts
export class CostMonitor {
  private costTracker = new Map<string, CostData>();
  private alertThresholds = {
    hourly: 5.0,   // $5/hour
    daily: 50.0,   // $50/day  
    monthly: 500.0 // $500/month
  };

  async trackCost(usage: UsageData): Promise<void> {
    const userId = usage.userId;
    const currentCost = this.costTracker.get(userId) || this.initializeCostData();
    
    // Calculate incremental cost
    const incrementalCost = this.calculateCost(usage);
    
    // Update running totals
    currentCost.hourly += incrementalCost;
    currentCost.daily += incrementalCost;
    currentCost.monthly += incrementalCost;
    currentCost.total += incrementalCost;
    
    this.costTracker.set(userId, currentCost);
    
    // Check thresholds
    await this.checkThresholds(userId, currentCost);
    
    // Update metrics
    AgentMetrics.getInstance().costSpent.set(
      { period: 'daily', user_id: userId }, 
      currentCost.daily
    );
  }

  private async checkThresholds(userId: string, costs: CostData): Promise<void> {
    // Hourly threshold
    if (costs.hourly > this.alertThresholds.hourly) {
      await this.sendCostAlert({
        userId,
        period: 'hourly',
        current: costs.hourly,
        threshold: this.alertThresholds.hourly,
        severity: 'warning'
      });
    }

    // Daily threshold  
    if (costs.daily > this.alertThresholds.daily) {
      await this.sendCostAlert({
        userId,
        period: 'daily', 
        current: costs.daily,
        threshold: this.alertThresholds.daily,
        severity: 'critical'
      });
      
      // Auto-pause expensive operations
      await this.pauseExpensiveOperations(userId);
    }

    // Monthly threshold
    if (costs.monthly > this.alertThresholds.monthly) {
      await this.sendCostAlert({
        userId,
        period: 'monthly',
        current: costs.monthly, 
        threshold: this.alertThresholds.monthly,
        severity: 'emergency'
      });
      
      // Suspend user account
      await this.suspendUser(userId);
    }
  }

  async generateCostReport(period: 'daily' | 'weekly' | 'monthly'): Promise<CostReport> {
    const report: CostReport = {
      period,
      timestamp: new Date().toISOString(),
      totalCost: 0,
      userCosts: [],
      modelCosts: [],
      toolCosts: [],
      recommendations: []
    };

    // Aggregate costs by user
    for (const [userId, costs] of this.costTracker.entries()) {
      const periodCost = this.getPeriodCost(costs, period);
      report.userCosts.push({
        userId,
        cost: periodCost,
        percentage: 0 // Will calculate after total
      });
      report.totalCost += periodCost;
    }

    // Calculate percentages
    report.userCosts.forEach(userCost => {
      userCost.percentage = (userCost.cost / report.totalCost) * 100;
    });

    // Generate recommendations
    report.recommendations = this.generateCostRecommendations(report);

    return report;
  }
}
```

## 🎯 **Production Checklist**

### **Pre-Deployment Checklist**
```markdown
## Security ✅
- [ ] API keys stored securely (environment variables/secrets)
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers implemented
- [ ] Docker containers use non-root users
- [ ] Network policies configured
- [ ] SSL/TLS certificates configured
- [ ] Backup encryption enabled

## Performance ✅  
- [ ] Connection pooling configured
- [ ] Caching strategy implemented
- [ ] Memory limits set
- [ ] CPU limits configured
- [ ] Horizontal pod autoscaling configured
- [ ] Load balancing configured
- [ ] CDN configured for static assets

## Monitoring ✅
- [ ] Health checks implemented
- [ ] Metrics collection configured
- [ ] Alerting rules configured
- [ ] Log aggregation setup
- [ ] Dashboard configured
- [ ] Cost monitoring enabled

## Reliability ✅
- [ ] Automated backups scheduled
- [ ] Disaster recovery plan tested
- [ ] Circuit breakers implemented
- [ ] Retry logic configured
- [ ] Graceful shutdown implemented
- [ ] Database migrations tested

## Compliance ✅
- [ ] Data privacy compliance (GDPR/CCPA)
- [ ] Audit logging enabled
- [ ] Data retention policies configured
- [ ] User consent management
- [ ] Third-party service agreements reviewed
```

### **Post-Deployment Verification**
```bash
#!/bin/bash
# scripts/verify-deployment.sh

set -e

echo "🚀 Verifying production deployment..."

# Check health endpoints
echo "Checking health endpoints..."
curl -f https://your-agent-domain.com/health || exit 1
curl -f https://your-agent-domain.com/ready || exit 1

# Check metrics endpoint
echo "Checking metrics..."
curl -f https://your-agent-domain.com/metrics | grep -q "agent_requests_total" || exit 1

# Test basic functionality
echo "Testing basic functionality..."
RESPONSE=$(curl -s -X POST https://your-agent-domain.com/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{"message": "Hello, system check"}')

echo "Response: $RESPONSE"

# Check if response contains expected fields
echo "$RESPONSE" | jq -e '.success == true' || exit 1

# Verify database connectivity
echo "Checking database connectivity..."
kubectl exec deployment/llm-agent -- pg_isready -h postgres-service || exit 1

# Verify Redis connectivity
echo "Checking Redis connectivity..."
kubectl exec deployment/llm-agent -- redis-cli -h redis-service ping | grep -q "PONG" || exit 1

# Check pod status
echo "Checking pod status..."
kubectl get pods -l app=llm-agent | grep -q "Running" || exit 1

# Check HPA status
echo "Checking horizontal pod autoscaler..."
kubectl get hpa llm-agent-hpa | grep -q "llm-agent" || exit 1

echo "✅ Production deployment verified successfully!"
```

Esta documentação fornece um guia completo para deployment em produção do sistema LLM Agent, cobrindo todos os aspectos críticos de segurança, performance, monitoramento e confiabilidade necessários para um ambiente de produção robusto.