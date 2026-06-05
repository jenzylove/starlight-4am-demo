console.log('[OTel] 🔵 Module loading...');
console.log('[OTel] DT_ENVIRONMENT:', process.env.DT_ENVIRONMENT ? '✓ SET' : '✗ MISSING');
console.log('[OTel] DT_API_TOKEN:', process.env.DT_API_TOKEN ? '✓ SET (length=' + process.env.DT_API_TOKEN.length + ')' : '✗ MISSING');

import { NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { trace } from '@opentelemetry/api';

const DT_ENVIRONMENT = process.env.DT_ENVIRONMENT;
const DT_API_TOKEN = process.env.DT_API_TOKEN;

let tracerProvider;
let isInitialized = false;

function initTelemetry() {
  console.log('[OTel] 🟡 initTelemetry called, isInitialized=', isInitialized);
  if (isInitialized) return;
  if (!DT_ENVIRONMENT || !DT_API_TOKEN) {
    console.warn('[OTel] ❌ Missing env vars — telemetry disabled');
    return;
  }

  const exportUrl = `${DT_ENVIRONMENT}/api/v2/otlp/v1/traces`;
  console.log('[OTel] Configuring exporter for', exportUrl);

  const exporter = new OTLPTraceExporter({
    url: exportUrl,
    headers: {
      Authorization: `Api-Token ${DT_API_TOKEN}`,
    },
  });

  const originalExport = exporter.export.bind(exporter);
  exporter.export = (spans, resultCallback) => {
    console.log(`[OTel] 📤 Exporting ${spans.length} span(s)`);
    return originalExport(spans, (result) => {
      if (result.code === 0) {
        console.log(`[OTel] ✅ Export SUCCESS`);
      } else {
        console.error(`[OTel] ❌ Export FAILED:`, JSON.stringify(result, null, 2));
      }
      resultCallback(result);
    });
  };

  tracerProvider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      'service.name': 'starlight-api',
      'service.version': '1.0.0',
      'deployment.environment': 'production',
    }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  tracerProvider.register();

  isInitialized = true;
  console.log('[OTel] ✅ Telemetry initialized → Dynatrace');
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

console.log('[OTel] 🔵 Module loaded successfully');