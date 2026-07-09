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

    // Task 3: Prevent Duplicate Processing
    if (deploymentId) {
      if (processedDeployments.has(deploymentId)) {
        console.log(`[Webhook] Deployment ${deploymentId} already processed. Acknowledging safely.`);
        return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
      }
      processedDeployments.add(deploymentId);
      
      // Optional: Prevent memory leak by clearing old IDs after a few hours
      setTimeout(() => processedDeployments.delete(deploymentId), 1000 * 60 * 60 * 24);
    }

    // Task 2: Fire and Forget Notification (Do NOT await)
    sendWhatsAppNotification(payload).catch((err) => {
      console.error("WhatsApp Send Failed:", err);
    });

    // INSTANTLY return 200 OK to kill the retry loop from the deployment server
    return NextResponse.json(
      { success: true, message: "Webhook acknowledged successfully" },
      { status: 200 }
    );
    
  } catch (error) {
    console.error("Webhook processing error:", error);
    // EMERGENCY FAILSAFE: Always return 200 to stop the spam loop, even on fatal errors.
    return NextResponse.json(
      { success: true, message: "Failsafe triggered" },
      { status: 200 }
    );
  }
}
