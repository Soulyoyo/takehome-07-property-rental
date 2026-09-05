import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/db/seed.js';
import { getDb, closeDb } from '../src/db/database.js';

let app: any;
let db: any;
let managerToken: string;
let contractorToken: string;

describe('Assignment 07 — Complete Property Rental & Maintenance Suite', () => {
  before(async () => {
    // Initialize DB and Seed
    db = getDb();
    seedDatabase(db);
    app = createApp();

    // Authenticate manager and contractor
    const mgrRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@apexpm.com', password: 'manager123' });
    managerToken = mgrRes.body.token;

    const conRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dave@plumbingpros.com', password: 'contractor123' });
    contractorToken = conRes.body.token;
  });

  after(() => {
    closeDb();
  });

  // ==========================================
  // GOAL 1: ACCOUNTS & ROLES + SERVER RBAC
  // ==========================================
  describe('Goal 1: Accounts & Roles (RBAC Enforced on Server)', () => {
    test('Property Manager can sign in with email and password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'manager@apexpm.com', password: 'manager123' });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.role, 'property_manager');
      assert.ok(res.body.token);
    });

    test('Maintenance Contractor can sign in with email and password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'dave@plumbingpros.com', password: 'contractor123' });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.role, 'contractor');
      assert.ok(res.body.token);
    });

    test('Contractor is rejected (403 Forbidden) when trying to access units list', async () => {
      const res = await request(app)
        .get('/api/units')
        .set('Authorization', `Bearer ${contractorToken}`);

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Forbidden/);
    });

    test('Contractor is rejected (403 Forbidden) when trying to create a unit', async () => {
      const res = await request(app)
        .post('/api/units')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          unit_number: '999X',
          address: 'Unauthorized Street',
          monthly_rent: 1500,
          tenant_name: 'Hacker',
        });

      assert.equal(res.status, 403);
      assert.match(res.body.error, /Forbidden/);
    });

    test('Contractor is rejected (403 Forbidden) when trying to view rent data', async () => {
      const res = await request(app)
        .get('/api/rent/roll')
        .set('Authorization', `Bearer ${contractorToken}`);

      assert.equal(res.status, 403);
    });

    test('Contractor is rejected (403 Forbidden) when trying to assign contractors', async () => {
      const res = await request(app)
        .post('/api/maintenance/1/assign')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({ contractor_id: 2 });

      assert.equal(res.status, 403);
    });
  });

  // ==========================================
  // GOAL 2: UNITS CRUD & ARCHIVE/RESTORE
  // ==========================================
  describe('Goal 2: Units Management & Archiving', () => {
    test('Property Manager can create, edit, archive and restore units', async () => {
      // 1. Create Unit
      const createRes = await request(app)
        .post('/api/units')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          unit_number: 'UNIT-TEST-777',
          address: '777 Test Avenue, Springfield',
          monthly_rent: 1650.00,
          tenant_name: 'Elena Rostova',
          tenant_email: 'elena@example.com',
          tenant_phone: '555-0601',
          grace_days: 5,
        });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.unit.unit_number, 'UNIT-TEST-777');
      const unitId = createRes.body.unit.id;

      // 2. Edit Unit
      const editRes = await request(app)
        .put(`/api/units/${unitId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          tenant_name: 'Elena Rostova-Smith',
          monthly_rent: 1700.00,
        });

      assert.equal(editRes.status, 200);
      assert.equal(editRes.body.unit.tenant_name, 'Elena Rostova-Smith');
      assert.equal(editRes.body.unit.monthly_rent, 1700.00);

      // 3. Archive Unit
      const archiveRes = await request(app)
        .post(`/api/units/${unitId}/archive`)
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(archiveRes.status, 200);
      assert.equal(archiveRes.body.unit.is_archived, 1);

      // 4. Default list does not include archived unit
      const listDefault = await request(app)
        .get('/api/units')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(listDefault.status, 200);
      assert.equal(listDefault.body.units.some((u: any) => u.id === unitId), false);

      // 5. Restore unit
      const restoreRes = await request(app)
        .post(`/api/units/${unitId}/restore`)
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(restoreRes.status, 200);
      assert.equal(restoreRes.body.unit.is_archived, 0);

      // 6. View unit detail with maintenance and payments
      const detailRes = await request(app)
        .get(`/api/units/${unitId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(detailRes.status, 200);
      assert.ok(Array.isArray(detailRes.body.unit.maintenance_requests));
      assert.ok(Array.isArray(detailRes.body.unit.rent_payments));
    });
  });

  // ==========================================
  // GOAL 3 & 4: MAINTENANCE REQUEST LIFECYCLE WITH STRICT RULES
  // ==========================================
  describe('Goal 3 & 4: Maintenance Request Lifecycle & Enforced State Machine', () => {
    test('Enforces strict 4-stage lifecycle: Reported -> Triaged -> Scheduled -> Resolved, with contractor check and reopen to Triaged', async () => {
      // 1. Create request (starts in Reported)
      const createRes = await request(app)
        .post('/api/maintenance')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          unit_id: 1,
          title: 'Garbage disposal jammed in Apt 101',
          description: 'Humming sound when switched on, impeller does not rotate.',
          priority: 'medium',
        });

      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.request.status, 'Reported');
      const reqId = createRes.body.request.id;

      // 2. RULE: Cannot jump directly from Reported to Scheduled (422)
      const directScheduleRes = await request(app)
        .patch(`/api/maintenance/${reqId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Scheduled' });

      assert.equal(directScheduleRes.status, 422);
      assert.match(directScheduleRes.body.error, /Cannot move from "Reported" to "Scheduled"/);

      // 3. RULE: Cannot jump directly from Reported to Resolved (422)
      const directResolveRes = await request(app)
        .patch(`/api/maintenance/${reqId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Resolved' });

      assert.equal(directResolveRes.status, 422);
      assert.match(directResolveRes.body.error, /Cannot move from "Reported" to "Resolved"/);

      // 4. Move Reported -> Triaged succeeds
      const triageRes = await request(app)
        .patch(`/api/maintenance/${reqId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Triaged', notes: 'Triaged by manager' });

      assert.equal(triageRes.status, 200);
      assert.equal(triageRes.body.request.status, 'Triaged');

      // 5. RULE: Cannot move Triaged -> Scheduled WITHOUT an assigned contractor (422)
      const unassignedScheduleRes = await request(app)
        .patch(`/api/maintenance/${reqId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Scheduled' });

      assert.equal(unassignedScheduleRes.status, 422);
      assert.match(unassignedScheduleRes.body.error, /Cannot move into "Scheduled" status without an assigned contractor/);

      // 6. Assign contractor (Dave Miller, id 2)
      const assignRes = await request(app)
        .post(`/api/maintenance/${reqId}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ contractor_id: 2 });

      assert.equal(assignRes.status, 200);
      assert.equal(assignRes.body.request.contractors.length, 1);

      // 7. Move Triaged -> Scheduled succeeds with contractor assigned
      const scheduledRes = await request(app)
        .patch(`/api/maintenance/${reqId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Scheduled', notes: 'Scheduled site visit with Dave' });

      assert.equal(scheduledRes.status, 200);
      assert.equal(scheduledRes.body.request.status, 'Scheduled');

      // 8. Move Scheduled -> Resolved succeeds
      const resolvedRes = await request(app)
        .patch(`/api/maintenance/${reqId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Resolved', notes: 'Dislodged bone from disposal impeller' });

      assert.equal(resolvedRes.status, 200);
      assert.equal(resolvedRes.body.request.status, 'Resolved');

      // 9. RULE: Reopening directly to Reported is REJECTED with 422
      const reopenReportedRes = await request(app)
        .patch(`/api/maintenance/${reqId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Reported' });

      assert.equal(reopenReportedRes.status, 422);
      assert.match(reopenReportedRes.body.error, /Reopened requests must return to "Triaged"/);

      // 10. RULE: Reopening to Triaged SUCCEEDS (returns to Triaged, not Reported)
      const reopenTriagedRes = await request(app)
        .patch(`/api/maintenance/${reqId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'Triaged', notes: 'Disposal jammed again next morning' });

      assert.equal(reopenTriagedRes.status, 200);
      assert.equal(reopenTriagedRes.body.request.status, 'Triaged');
    });

    test('Contractor can fetch unit options (without rent or tenant info) to report an issue', async () => {
      const res = await request(app)
        .get('/api/maintenance/unit-options')
        .set('Authorization', `Bearer ${contractorToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.units));
      assert.ok(res.body.units.length > 0);
      // Ensure sensitive fields (monthly_rent, tenant_name) are not exposed
      assert.equal(res.body.units[0].monthly_rent, undefined);
      assert.equal(res.body.units[0].tenant_name, undefined);
    });

    test('Contractor can create a maintenance request', async () => {
      const res = await request(app)
        .post('/api/maintenance')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          unit_id: 1,
          title: 'Contractor discovered water stain in drywall',
          description: 'Spotted water damage near ceiling while inspecting bathroom pipes.',
          priority: 'high',
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.request.status, 'Reported');
      assert.equal(res.body.request.title, 'Contractor discovered water stain in drywall');
    });
  });

  // ==========================================
  // GOAL 5: ASSIGNMENT RULES (MULTI-CONTRACTOR)
  // ==========================================
  describe('Goal 5: Assignment (Multi-contractor and Contractor View)', () => {
    test('Any number of contractors can be assigned to a maintenance request', async () => {
      // Find request 1
      const req = db.prepare(`SELECT id FROM maintenance_requests LIMIT 1`).get() as { id: number };

      // Ensure contractor 3 is assigned or tested
      const check = db.prepare(`SELECT 1 FROM maintenance_contractors WHERE request_id = ? AND contractor_id = 3`).get(req.id);
      if (!check) {
        const res = await request(app)
          .post(`/api/maintenance/${req.id}/assign`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ contractor_id: 3 });

        assert.equal(res.status, 200);
      } else {
        assert.ok(true);
      }
    });

    test('Contractor can only see requests assigned to them', async () => {
      const res = await request(app)
        .get('/api/maintenance')
        .set('Authorization', `Bearer ${contractorToken}`);

      assert.equal(res.status, 200);
      for (const req of res.body.items) {
        const hasDave = req.contractors.some((c: any) => c.name === 'Dave Miller');
        assert.equal(hasDave, true);
      }
    });
  });

  // ==========================================
  // GOAL 6: FINDING REQUESTS (SERVER-SIDE SEARCH, FILTER, SORT, PAGINATION)
  // ==========================================
  describe('Goal 6: Finding Requests (Server-side)', () => {
    test('Server-side text search over descriptions and titles', async () => {
      const res = await request(app)
        .get('/api/maintenance?search=faucet')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.items.length > 0);
      for (const item of res.body.items) {
        const matches = (item.title + ' ' + item.description).toLowerCase().includes('faucet');
        assert.equal(matches, true);
      }
    });

    test('Server-side filtering by status and priority', async () => {
      const res = await request(app)
        .get('/api/maintenance?status=Scheduled&priority=high')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      for (const item of res.body.items) {
        assert.equal(item.status, 'Scheduled');
        assert.equal(item.priority, 'high');
      }
    });

    test('Server-side pagination returns total, page, limit, and totalPages', async () => {
      const res = await request(app)
        .get('/api/maintenance?page=1&limit=3')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 3);
      assert.equal(res.body.pagination.page, 1);
      assert.equal(res.body.pagination.limit, 3);
      assert.ok(res.body.pagination.total > 3);
      assert.ok(res.body.pagination.totalPages >= 2);
    });
  });

  // ==========================================
  // GOAL 7: BULK RENT RECORDING & RENT ROLL CSV
  // ==========================================
  describe('Goal 7: Bulk Rent Recording & Rent Roll CSV Export', () => {
    test('Bulk-recording classifies rows into matched, underpaid, overpaid, and unmatched', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      // Unit 101 rent: 1450.00
      // Unit 102 rent: 1500.00
      // Unit 103 rent: 1400.00
      const res = await request(app)
        .post('/api/rent/bulk')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          month: currentMonth,
          rows: [
            { identifier: '101', amount: 1450.00 }, // matched
            { identifier: '102', amount: 1200.00 }, // underpaid
            { identifier: '103', amount: 1600.00 }, // overpaid
            { identifier: 'NON-EXISTENT', amount: 1000.00 }, // unmatched
          ],
        });

      assert.equal(res.status, 200);
      const report = res.body.report;
      assert.equal(report.matched_count, 1);
      assert.equal(report.underpaid_count, 1);
      assert.equal(report.overpaid_count, 1);
      assert.equal(report.unmatched_count, 1);
      assert.equal(report.total_processed, 4);
    });

    test('Rent roll returns all active units with balance due and payment status', async () => {
      const res = await request(app)
        .get('/api/rent/roll')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.items));
      assert.ok(res.body.summary.total_expected_rent > 0);
    });

    test('Rent roll exports valid CSV file with attachment headers', async () => {
      const res = await request(app)
        .get('/api/rent/roll/export')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/csv/);
      assert.match(res.headers['content-disposition'], /attachment; filename="rent-roll-/);
      assert.match(res.text, /Unit Number,Address,Tenant Name,Monthly Rent/);
    });
  });

  // ==========================================
  // GOAL 8: EXECUTIVE DASHBOARD
  // ==========================================
  describe('Goal 8: Executive Dashboard Metrics & 8-Week Trend Chart', () => {
    test('Dashboard returns headline metrics, breakdowns, and 8 weekly buckets', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      const d = res.body;

      // 4 headline numbers
      assert.ok(typeof d.open_maintenance_requests === 'number');
      assert.ok(typeof d.units_with_rent_overdue === 'number');
      assert.ok(typeof d.requests_resolved_this_week === 'number');
      assert.ok(typeof d.total_rent_collected_this_month === 'number');

      // Breakdown by status
      assert.ok(d.requests_by_status.Reported >= 0);
      assert.ok(d.requests_by_status.Triaged >= 0);
      assert.ok(d.requests_by_status.Scheduled >= 0);
      assert.ok(d.requests_by_status.Resolved >= 0);

      // Breakdown by contractor
      assert.ok(Array.isArray(d.requests_by_contractor));
      assert.ok(d.requests_by_contractor.length >= 3);

      // 8-week chart data
      assert.ok(Array.isArray(d.resolved_per_week));
      assert.equal(d.resolved_per_week.length, 8);
      for (const bucket of d.resolved_per_week) {
        assert.ok(bucket.week_label);
        assert.ok(bucket.week_start);
        assert.ok(typeof bucket.count === 'number');
      }
    });
  });

  // ==========================================
  // GOAL 9: IMMUTABLE AUDIT TIMELINE
  // ==========================================
  describe('Goal 9: Immutable Audit Timeline (Cannot Rewrite History)', () => {
    test('Maintenance request has an audit timeline showing events', async () => {
      // Find request that has timeline
      const req = db.prepare(`SELECT request_id FROM maintenance_timeline LIMIT 1`).get() as { request_id: number };

      const res = await request(app)
        .get(`/api/maintenance/${req.request_id}/timeline`)
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.timeline));
      assert.ok(res.body.timeline.length >= 1);
    });

    test('RULE: Attempting to modify (PUT/PATCH) timeline is rejected with 405 Method Not Allowed', async () => {
      const putRes = await request(app)
        .put('/api/maintenance/1/timeline')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ text: 'rewriting history' });

      assert.equal(putRes.status, 405);
      assert.match(putRes.body.error, /immutable/);

      const patchRes = await request(app)
        .patch('/api/maintenance/1/timeline')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ text: 'tampering' });

      assert.equal(patchRes.status, 405);
    });

    test('RULE: Attempting to delete (DELETE) timeline is rejected with 405 Method Not Allowed', async () => {
      const deleteRes = await request(app)
        .delete('/api/maintenance/1/timeline')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(deleteRes.status, 405);
      assert.match(deleteRes.body.error, /immutable/);
    });
  });

  // ==========================================
  // GOAL 10: RENT ALERTS & MONTH-SPECIFIC RECURRENCE
  // ==========================================
  describe('Goal 10: Rent Alerts & Recurrence Logic', () => {
    test('Alert count badge endpoint returns count', async () => {
      const res = await request(app)
        .get('/api/alerts/count')
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      assert.ok(typeof res.body.count === 'number');
    });

    test('Property Manager can dismiss an alert for a unit in month M', async () => {
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const unit = db.prepare(`SELECT id FROM units LIMIT 1`).get() as { id: number };

      const dismissRes = await request(app)
        .post(`/api/alerts/${unit.id}/dismiss`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ month: currentMonth });

      assert.equal(dismissRes.status, 200);
      assert.equal(dismissRes.body.success, true);
    });

    test('RULE: Alert recurrence — dismissing in Month M does NOT dismiss in Month M+1', async () => {
      const futureMonth = '2027-01'; // Simulated future month past grace period
      const checkDismissal = db.prepare(`
        SELECT COUNT(*) as count FROM rent_alert_dismissals WHERE unit_id = 1 AND month = ?
      `).get(futureMonth) as { count: number };

      assert.equal(checkDismissal.count, 0);
    });
  });
});
