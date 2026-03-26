export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function buffersMatch(current: Uint8Array, expected: Uint8Array) {
  if (current.length !== expected.length) return false;

  for (let i = 0; i < current.length; i += 1) {
    if (current[i] !== expected[i]) return false;
  }

  return true;
}

export function subscriptionUsesVapidKey(subscription: PushSubscription, vapidPublicKey: string) {
  const currentKeyBuffer = subscription.options.applicationServerKey;
  if (!currentKeyBuffer) return false;

  const currentKey = new Uint8Array(currentKeyBuffer);
  const expectedKey = urlBase64ToUint8Array(vapidPublicKey);

  return buffersMatch(currentKey, expectedKey);
}

export function subscriptionToRecord(subscription: PushSubscription) {
  const subscriptionJson = subscription.toJSON();
  const keys = subscriptionJson.keys;

  if (!subscriptionJson.endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error("Assinatura push inválida.");
  }

  return {
    endpoint: subscriptionJson.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  };
}
