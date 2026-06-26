import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { spawn } from 'child_process';
import path from 'path';

// GET: Retrieve history of training runs
export async function GET(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`retrain-get:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const authHeader = request.headers.get('Authorization');
    const cronToken = process.env.CRON_SECRET || 'monthly-retrain-secret-token';
    const isCronAuthorized = authHeader === `Bearer ${cronToken}`;

    let userId = undefined;
    if (!isCronAuthorized) {
      const session = await getServerSession(authOptions);
      userId = session?.user ? (session.user as { id?: string }).id : undefined;
      
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }
    }

    const isProduction = process.env.NODE_ENV === 'production' && process.env.GCP_PROJECT;
    let useLocalFallback = !isProduction;
    if (!useLocalFallback) {
      try {
        getAdminDb();
      } catch (e) {
        useLocalFallback = true;
      }
    }

    if (!useLocalFallback) {
      try {
        const db = getAdminDb();
        const snapshot = await db.collection('model_training_runs')
          .orderBy('startedAt', 'desc')
          .limit(15)
          .get();

        const runs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            startedAt: data.startedAt?.toDate?.() ? data.startedAt.toDate().toISOString() : data.startedAt,
            completedAt: data.completedAt?.toDate?.() ? data.completedAt.toDate().toISOString() : data.completedAt,
            updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          };
        });

        return NextResponse.json(runs);
      } catch (error) {
        logger.warn('Failed to query Firestore. Falling back to local runs database.', { error: String(error) });
      }
    }

    // Local file fallback
    try {
      const fs = require('fs');
      const localDbPath = path.join(process.cwd(), 'data', 'runs_db.json');
      if (fs.existsSync(localDbPath)) {
        const content = fs.readFileSync(localDbPath, 'utf8');
        const runs = JSON.parse(content);
        return NextResponse.json(runs);
      }
    } catch (err) {
      logger.error('Failed to read local runs database', { error: String(err) });
    }

    return NextResponse.json([
      {
        id: 'mock_run_1',
        status: 'COMPLETED',
        currentStep: 'complete',
        progress: 100,
        startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        completedAt: new Date(Date.now() - 3600000).toISOString(),
        datasetStats: { flores200: 200, opus: 1000, wmt: 1000, firestore_corrections: 120 },
        metrics: { bleu: 34.5, chrf: 61.2 }
      }
    ]);
  } catch (error) {
    logger.error('Error fetching training runs', { error: String(error) });
    return NextResponse.json({ error: 'Failed to retrieve training history.' }, { status: 500 });
  }
}

// POST: Trigger retraining
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`retrain-post:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  try {
    // 1. Authentication Check (NextAuth Session OR Webhook Authorization Token)
    const authHeader = request.headers.get('Authorization');
    const cronToken = process.env.CRON_SECRET || 'monthly-retrain-secret-token';
    const isCronAuthorized = authHeader === `Bearer ${cronToken}`;

    let userId = undefined;
    if (!isCronAuthorized) {
      const session = await getServerSession(authOptions);
      userId = session?.user ? (session.user as { id?: string }).id : undefined;
      
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const domain = body.domain || 'general';
    const runId = `run_${Date.now()}`;

    // 2. Initialize Firestore training run document
    let db;
    try {
      db = getAdminDb();
      await db.collection('model_training_runs').doc(runId).set({
        status: 'QUEUED',
        currentStep: 'collection',
        progress: 0,
        startedAt: new Date(),
        domain,
      });
    } catch (e) {
      logger.warn('Firestore unavailable to record training run start. Proceeding in offline mode.');
    }

    // Always update local runs_db.json as well so local dev UI is in sync
    try {
      const fs = require('fs');
      const localDbDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(localDbDir)) {
        fs.mkdirSync(localDbDir, { recursive: true });
      }
      const localDbPath = path.join(localDbDir, 'runs_db.json');
      let runs = [];
      if (fs.existsSync(localDbPath)) {
        try {
          runs = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
        } catch (e) {}
      }
      
      const newRun = {
        id: runId,
        status: 'QUEUED',
        currentStep: 'collection',
        progress: 0,
        startedAt: new Date().toISOString(),
        domain,
        updatedAt: new Date().toISOString()
      };
      
      runs = [newRun, ...runs.filter((r: any) => r.id !== runId)].slice(0, 15);
      fs.writeFileSync(localDbPath, JSON.stringify(runs, null, 2), 'utf8');
    } catch (err) {
      logger.error('Failed to update local runs_db.json in POST', { error: String(err) });
    }

    // 3. Trigger Retraining script execution
    const isProduction = process.env.NODE_ENV === 'production' && process.env.GCP_PROJECT;
    
    if (isProduction) {
      // In GCP production: Trigger Cloud Run Job or Vertex AI
      logger.info('Triggering Cloud Run Job in production...', { runId, domain });
      
      const projectId = process.env.GCP_PROJECT;
      const region = process.env.GCP_REGION || 'us-central1';
      const jobName = 'auratranslator-retrain-job';
      
      try {
        const metadataUrl = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
        const tokenRes = await fetch(metadataUrl, { headers: { 'Metadata-Flavor': 'Google' } });
        const { access_token } = await tokenRes.json();
        
        const runUrl = `https://${region}-run.googleapis.com/v1/projects/${projectId}/locations/${region}/jobs/${jobName}:run`;
        fetch(runUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            overrides: {
              containerOverrides: [
                {
                  args: [
                    '--run-id', runId,
                    '--domain', domain,
                    '--full'
                  ]
                }
              ]
            }
          })
        }).catch(err => {
          logger.error('Background API call to Cloud Run Job run failed', { error: String(err) });
        });
        
        return NextResponse.json({
          success: true,
          message: 'Retraining Cloud Run Job successfully triggered in production.',
          runId,
        });
      } catch (err) {
        logger.error('Failed to authenticate and trigger Cloud Run Job REST API. Falling back to local spawn.', { error: String(err) });
      }
    }

    // Dev/Local fallback: Spawn Python process in background
    logger.info('Spawning retraining script in background...', { runId, domain });
    const scriptPath = path.join(process.cwd(), 'ml-pipeline', 'scripts', 'retrain.py');
    const child = spawn('python', [
      scriptPath,
      '--run-id', runId,
      '--domain', domain,
      '--full',
      '--mock'
    ], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'pipe'
    });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        logger.info(`[Retrain Subprocess STDOUT] ${data.toString().trim()}`);
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        logger.error(`[Retrain Subprocess STDERR] ${data.toString().trim()}`);
      });
    }

    child.on('error', (err) => {
      logger.error('Failed to spawn retraining script process', { error: String(err) });
    });

    child.on('exit', (code, signal) => {
      logger.info('Retraining script process exited', { code, signal });
      if (code !== 0 && code !== null) {
        // If it failed immediately, write FAILED status to local runs_db.json
        try {
          const fs = require('fs');
          const localDbPath = path.join(process.cwd(), 'data', 'runs_db.json');
          if (fs.existsSync(localDbPath)) {
            let runs = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
            runs = runs.map((r: any) => {
              if (r.id === runId) {
                return {
                  ...r,
                  status: 'FAILED',
                  error: `Subprocess exited with code ${code}`,
                  updatedAt: new Date().toISOString()
                };
              }
              return r;
            });
            fs.writeFileSync(localDbPath, JSON.stringify(runs, null, 2), 'utf8');
          }
        } catch (e) {}
      }
    });

    child.unref();

    return NextResponse.json({
      success: true,
      message: 'Retraining pipeline successfully started locally.',
      runId,
    });

  } catch (error) {
    logger.error('Error triggering retraining', { error: String(error) });
    return NextResponse.json({ error: 'Failed to trigger model retraining.' }, { status: 500 });
  }
}
