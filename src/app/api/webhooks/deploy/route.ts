import { NextResponse } from 'next/server';

// In-memory cache to store processed deployment IDs for idempotency.
// Note: In a multi-instance (serverless) environment, a database or Redis is safer,
// but this effectively catches rapid consecutive retries hitting the same instance.
const processedDeployments = new Set<string>();

// Stub function for WhatsApp notification (replace with your actual implementation)
async function sendWhatsAppNotification(payload: any) {
  console.log('[WhatsApp] Sending deployment notification:', payload);
  // Actual fetch/axios call to WhatsApp API goes here
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const deploymentId = payload.deploymentId || payload.id;

    // Task 2: Idempotency Check
    if (deploymentId) {
      if (processedDeployments.has(deploymentId)) {
        console.log(`[Webhook] Deployment ${deploymentId} already processed. Acknowledging safely.`);
        return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
      }
      processedDeployments.add(deploymentId);
      
      // Optional: Prevent memory leak by clearing old IDs after a few hours
      setTimeout(() => processedDeployments.delete(deploymentId), 1000 * 60 * 60 * 24);
    }

    // Call WhatsApp API to send the message
    await sendWhatsAppNotification(payload);

    // CRITICAL (Task 1): Return 200 OK immediately so the webhook provider stops retrying!
    return NextResponse.json({ success: true }, { status: 200 });
    
  } catch (error) {
    console.error("Notification Webhook Error:", error);
    // Even on error, we return 200 to stop retry spam. The provider already sent the webhook.
    // If we return 500, it will retry and spam WhatsApp again if the error happened AFTER sending.
    return NextResponse.json({ error: "Processed with internal errors" }, { status: 200 });
  }
}
