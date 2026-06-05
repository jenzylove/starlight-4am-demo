import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { trace } from '@opentelemetry/api';

const DT_ENVIRONMENT = process.env.DT_ENVIRONMENT;
const DT_API_TOKEN = process.env.DT_API_TOKEN;

let tracerProvider;
let isInitialized = false;

function initTelemetry() {
  if (isInitialized) return;
  if (!DT_ENVIRONMENT || !DT_API_TOKEN) {
    console.warn('[OTel] Missing DT_ENVIRONMENT or DT_API_TOKEN — telemetry disabled');
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: `${DT_ENVIRONMENT}/api/v2/otlp/v1/traces`,
    headers: {
      Authorization: `Api-Token ${DT_API_TOKEN}`,
    },
  });

  tracerProvider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      'service.name': 'starlight-api',
      'service.version': '1.0.0',
      'deployment.environment': 'production',
    }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });

  tracerProvider.register();

  isInitialized = true;
  console.log('[OTel] Telemetry initialized → Dynatrace');
}

export function getTracer() {
  initTelemetry();
  return trace.getTracer('starlight-api');
}

export async function flushTelemetry() {
  if (tracerProvider) {
    await tracerProvider.forceFlush();
  }
}