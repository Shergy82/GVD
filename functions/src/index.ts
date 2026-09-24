import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * Atomic Reference Generator Function
 * Generates unique readable references: GVD-PRJ-2026-001, GVD-PO-2026-0001, GVD-SCO-2026-0001
 */
export const generateReference = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { prefix } = data; // 'PRJ', 'PO', or 'SCO'
  const year = new Date().getFullYear();
  const counterRef = db.collection('counters').doc(`${prefix}-${year}`);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    let nextNum = 1;
    if (doc.exists) {
      nextNum = (doc.data()?.current || 0) + 1;
    }
    transaction.set(counterRef, { current: nextNum }, { merge: true });

    const formattedNum = nextNum.toString().padStart(prefix === 'PRJ' ? 3 : 4, '0');
    return `GVD-${prefix}-${year}-${formattedNum}`;
  });
});

/**
 * Scheduled Certificate Expiry Check (Daily at 06:00 UK Time)
 */
export const checkCertificateExpiries = functions.pubsub
  .schedule('0 6 * * *')
  .timeZone('Europe/London')
  .onRun(async (context) => {
    const now = new Date();
    const snap = await db.collection('competencies').where('doesNotExpire', '==', false).get();

    const batch = db.batch();
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.expiryDate) return;

      const expiry = new Date(data.expiryDate);
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));

      let newStatus = data.reviewStatus;
      if (diffDays <= 0) {
        newStatus = 'Expired';
      } else if (diffDays <= 60 && data.reviewStatus === 'Valid') {
        newStatus = 'Expiring Soon';
      }

      if (newStatus !== data.reviewStatus) {
        batch.update(docSnap.ref, { reviewStatus: newStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    });

    await batch.commit();
    console.log('Daily certificate expiry check completed.');
  });

/**
 * Sanitized Customer Projection Endpoint for QR Tokens
 */
export const getSanitizedCustomerView = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const token = req.query.token as string;

  if (!token) {
    res.status(400).json({ error: 'Access token required' });
    return;
  }

  const tokenSnap = await db.collection('customer_access_tokens')
    .where('rawToken', '==', token)
    .where('isRevoked', '==', false)
    .limit(1)
    .get();

  if (tokenSnap.empty) {
    res.status(404).json({ error: 'Invalid or revoked customer link.' });
    return;
  }

  const tokenData = tokenSnap.docs[0].data();
  const prjSnap = await db.collection('projects').doc(tokenData.projectId).get();

  if (!prjSnap.exists) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const prj = prjSnap.data();

  // Return strictly sanitized customer projection
  res.json({
    projectReference: prj?.reference,
    siteAddress: prj?.siteAddress,
    postcode: prj?.postcode,
    customerName: prj?.customerName,
    responsibleManagerName: prj?.responsibleManagerName,
    responsibleManagerPhone: prj?.customerPhone || '020 7946 0123',
    lastUpdated: new Date().toISOString()
  });
});
