import bcrypt from 'bcryptjs';
import { getDb } from './database.js';

export function seedDatabase(customDb?: any) {
  const db = customDb || getDb();

  console.log('🌱 Seeding database with realistic rental portfolio data...');

  // 1. Clear existing data
  db.exec(`
    DELETE FROM rent_alert_dismissals;
    DELETE FROM maintenance_timeline;
    DELETE FROM maintenance_contractors;
    DELETE FROM maintenance_requests;
    DELETE FROM rent_payments;
    DELETE FROM units;
    DELETE FROM users;
  `);

  // 2. Insert Users
  const salt = bcrypt.genSaltSync(10);
  const managerHash = bcrypt.hashSync('manager123', salt);
  const contractorHash = bcrypt.hashSync('contractor123', salt);

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role, specialty)
    VALUES (?, ?, ?, ?, ?)
  `);

  const pm = insertUser.run('manager@apexpm.com', managerHash, 'Alex Sterling', 'property_manager', null);
  const pmId = pm.lastInsertRowid as number;

  const c1 = insertUser.run('dave@plumbingpros.com', contractorHash, 'Dave Miller', 'contractor', 'Plumbing & Drainage');
  const c1Id = c1.lastInsertRowid as number;

  const c2 = insertUser.run('sarah@sparkyelec.com', contractorHash, 'Sarah Chen', 'contractor', 'Electrical & HVAC');
  const c2Id = c2.lastInsertRowid as number;

  const c3 = insertUser.run('mike@apexhandyman.com', contractorHash, 'Mike Rodriguez', 'contractor', 'General Carpentry & Locks');
  const c3Id = c3.lastInsertRowid as number;

  // 3. Insert Units
  const insertUnit = db.prepare(`
    INSERT INTO units (unit_number, address, monthly_rent, tenant_name, tenant_email, tenant_phone, grace_days, is_archived)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const unitsData = [
    { num: '101', addr: '142 Elmwood Ave, Apt 101, Springfield', rent: 1450.00, tenant: 'Emma Watson', email: 'emma.w@example.com', phone: '555-0101', grace: 5, archived: 0 },
    { num: '102', addr: '142 Elmwood Ave, Apt 102, Springfield', rent: 1500.00, tenant: 'Liam Neeson', email: 'liam.n@example.com', phone: '555-0102', grace: 5, archived: 0 },
    { num: '103', addr: '142 Elmwood Ave, Apt 103, Springfield', rent: 1400.00, tenant: 'Sophia Martinez', email: 'sophia.m@example.com', phone: '555-0103', grace: 5, archived: 0 },
    { num: '201', addr: '88 Oakridge Heights, Unit 201, Springfield', rent: 1850.00, tenant: 'Noah Clark', email: 'noah.c@example.com', phone: '555-0201', grace: 5, archived: 0 },
    { num: '202', addr: '88 Oakridge Heights, Unit 202, Springfield', rent: 1900.00, tenant: 'Olivia Bennett', email: 'olivia.b@example.com', phone: '555-0202', grace: 5, archived: 0 },
    { num: '203', addr: '88 Oakridge Heights, Unit 203, Springfield', rent: 1850.00, tenant: 'James Wilson', email: 'james.w@example.com', phone: '555-0203', grace: 5, archived: 0 },
    { num: '301', addr: '210 Maple Grove Way, Apt 301, Springfield', rent: 2200.00, tenant: 'Ava Taylor', email: 'ava.t@example.com', phone: '555-0301', grace: 5, archived: 0 },
    { num: '302', addr: '210 Maple Grove Way, Apt 302, Springfield', rent: 2150.00, tenant: 'William Davis', email: 'will.d@example.com', phone: '555-0302', grace: 5, archived: 0 },
    { num: '401', addr: '500 Pinehurst Lofts, Penthouse 401, Springfield', rent: 2900.00, tenant: 'Charlotte King', email: 'charlotte.k@example.com', phone: '555-0401', grace: 5, archived: 0 },
    { num: '402', addr: '500 Pinehurst Lofts, Penthouse 402, Springfield', rent: 2800.00, tenant: 'Benjamin Scott', email: 'ben.s@example.com', phone: '555-0402', grace: 5, archived: 0 },
    { num: 'B1', addr: '142 Elmwood Ave, Garden Suite B1, Springfield', rent: 1100.00, tenant: 'Lucas Wright', email: 'lucas.w@example.com', phone: '555-0199', grace: 5, archived: 0 },
    { num: 'OLD-99', addr: '99 Historic Lane, Springfield (Decommissioned)', rent: 950.00, tenant: 'Former Tenant (Vacated)', email: 'former@example.com', phone: '555-0000', grace: 5, archived: 1 },
  ];

  const unitMap: Record<string, number> = {};
  for (const u of unitsData) {
    const res = insertUnit.run(u.num, u.addr, u.rent, u.tenant, u.email, u.phone, u.grace, u.archived);
    unitMap[u.num] = res.lastInsertRowid as number;
  }

  // 4. Current & Past Months Calculation
  const now = new Date();
  const formatMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthStr = formatMonth(now);
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = formatMonth(prevMonthDate);
  const twoMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const twoMonthsAgoStr = formatMonth(twoMonthsAgoDate);

  // 5. Insert Rent Payments
  const insertPayment = db.prepare(`
    INSERT INTO rent_payments (unit_id, amount, month, paid_at, payment_method, recorded_by_user_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Previous month: mostly fully paid
  for (const [num, id] of Object.entries(unitMap)) {
    if (num === 'OLD-99') continue;
    const unit = unitsData.find(u => u.num === num)!;
    insertPayment.run(id, unit.rent, prevMonthStr, `${prevMonthStr}-02 10:30:00`, 'Bank Transfer', pmId, 'Regular monthly payment');
  }

  // Current month payments:
  // - 101: Matched ($1,450)
  insertPayment.run(unitMap['101'], 1450.00, currentMonthStr, `${currentMonthStr}-01 09:15:00`, 'ACH Transfer', pmId, 'Full payment on 1st');
  // - 102: Underpaid ($1,000 out of $1,500)
  insertPayment.run(unitMap['102'], 1000.00, currentMonthStr, `${currentMonthStr}-02 14:20:00`, 'Check #4102', pmId, 'Partial payment received');
  // - 103: Overpaid ($1,500 for $1,400 rent)
  insertPayment.run(unitMap['103'], 1500.00, currentMonthStr, `${currentMonthStr}-01 11:00:00`, 'Bank Transfer', pmId, 'Includes $100 extra credit');
  // - 201: Matched ($1,850)
  insertPayment.run(unitMap['201'], 1850.00, currentMonthStr, `${currentMonthStr}-03 08:45:00`, 'Bank Transfer', pmId, 'Paid in full');
  // - 202: Matched ($1,900)
  insertPayment.run(unitMap['202'], 1900.00, currentMonthStr, `${currentMonthStr}-04 16:30:00`, 'ACH Transfer', pmId, 'Paid in full');
  // - 301: Matched ($2,200)
  insertPayment.run(unitMap['301'], 2200.00, currentMonthStr, `${currentMonthStr}-02 12:00:00`, 'Bank Transfer', pmId, 'Paid in full');
  // - 203, 302, 401, 402, B1: currently UNPAID this month (triggers overdue alert after grace period)

  // 6. Dismissed alert for previous month on 102 to demonstrate recurrence
  const insertDismissal = db.prepare(`
    INSERT INTO rent_alert_dismissals (unit_id, month, dismissed_by_user_id, dismissed_at)
    VALUES (?, ?, ?, ?)
  `);
  insertDismissal.run(unitMap['102'], prevMonthStr, pmId, `${prevMonthStr}-10 09:00:00`);

  // 7. Insert Maintenance Requests & Timelines
  const insertRequest = db.prepare(`
    INSERT INTO maintenance_requests (unit_id, title, description, priority, status, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAssignment = db.prepare(`
    INSERT INTO maintenance_contractors (request_id, contractor_id, assigned_at, assigned_by_user_id)
    VALUES (?, ?, ?, ?)
  `);

  const insertTimeline = db.prepare(`
    INSERT INTO maintenance_timeline (request_id, event_type, old_value, new_value, user_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Request 1: Reported (Unassigned, Faucet leak)
  const r1 = insertRequest.run(
    unitMap['101'],
    'Kitchen sink faucet dripping continuously',
    'Tenant reports constant drip under kitchen faucet handle. Water shutoff valve is slightly corroded.',
    'high',
    'Reported',
    pmId,
    new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString()
  );
  const r1Id = r1.lastInsertRowid as number;
  insertTimeline.run(r1Id, 'created', null, 'Reported', pmId, 'Created via phone call intake', new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString());

  // Request 2: Triaged (Unassigned, HVAC blower noise)
  const r2 = insertRequest.run(
    unitMap['201'],
    'HVAC fan motor grinding and rattling',
    'Heating unit emits a loud screeching noise when blower activates. Heat still works but noise disrupts sleep.',
    'urgent',
    'Triaged',
    pmId,
    new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
  );
  const r2Id = r2.lastInsertRowid as number;
  insertTimeline.run(r2Id, 'created', null, 'Reported', pmId, 'Reported by tenant email', new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString());
  insertTimeline.run(r2Id, 'status_change', 'Reported', 'Triaged', pmId, 'Triaged as urgent heating concern before cold weekend', new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString());
  insertTimeline.run(r2Id, 'note', null, null, pmId, 'Needs HVAC specialist with 240V certification', new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString());

  // Request 3: Scheduled (Assigned to Sarah Chen, Electrical)
  const r3 = insertRequest.run(
    unitMap['103'],
    'Master bedroom GFCI outlet sparked and tripped',
    'Tenant plugged in space heater, heard a pop and breaker tripped. Resetting breaker does not restore outlet.',
    'high',
    'Scheduled',
    pmId,
    new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
  );
  const r3Id = r3.lastInsertRowid as number;
  insertTimeline.run(r3Id, 'created', null, 'Reported', pmId, 'Reported by tenant', new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString());
  insertTimeline.run(r3Id, 'status_change', 'Reported', 'Triaged', pmId, 'Verified electrical safety hazard', new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString());
  insertAssignment.run(r3Id, c2Id, new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), pmId);
  insertTimeline.run(r3Id, 'assignment', null, 'Sarah Chen', pmId, 'Assigned primary electrical contractor', new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString());
  insertTimeline.run(r3Id, 'status_change', 'Triaged', 'Scheduled', pmId, 'Scheduled inspection for tomorrow at 10:00 AM', new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString());

  // Request 4: Scheduled (Multi-contractor assigned: Dave Miller & Mike Rodriguez)
  const r4 = insertRequest.run(
    unitMap['301'],
    'Bathroom floor tile damaged around toilet flange leak',
    'Toilet rocked loose, water seeped under subfloor. Requires plumber to pull toilet and replace wax ring, plus carpenter to inspect subfloor and re-lay tile.',
    'medium',
    'Scheduled',
    pmId,
    new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString()
  );
  const r4Id = r4.lastInsertRowid as number;
  insertTimeline.run(r4Id, 'created', null, 'Reported', pmId, 'Reported after routine inspection', new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString());
  insertTimeline.run(r4Id, 'status_change', 'Reported', 'Triaged', pmId, 'Multi-trade task identified', new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString());
  insertAssignment.run(r4Id, c1Id, new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), pmId);
  insertTimeline.run(r4Id, 'assignment', null, 'Dave Miller', pmId, 'Assigned plumbing contractor', new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString());
  insertAssignment.run(r4Id, c3Id, new Date(Date.now() - 1000 * 60 * 60 * 45).toISOString(), pmId);
  insertTimeline.run(r4Id, 'assignment', null, 'Mike Rodriguez', pmId, 'Assigned carpentry/flooring contractor', new Date(Date.now() - 1000 * 60 * 60 * 45).toISOString());
  insertTimeline.run(r4Id, 'status_change', 'Triaged', 'Scheduled', pmId, 'Coordinated joint site visit for Friday', new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString());
  insertTimeline.run(r4Id, 'note', null, null, c1Id, 'I have replacement 4-inch wax ring and brass bolts ready', new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString());

  // Request 5: Resolved this week (Assigned to Dave Miller)
  const r5 = insertRequest.run(
    unitMap['102'],
    'Main drain slow and backing up into bathtub',
    'Bathtub filling with soapy greywater whenever washing machine discharges. Snaked 25ft and cleared hair obstruction.',
    'urgent',
    'Resolved',
    pmId,
    new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()
  );
  const r5Id = r5.lastInsertRowid as number;
  insertTimeline.run(r5Id, 'created', null, 'Reported', pmId, 'Urgent call from tenant', new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString());
  insertTimeline.run(r5Id, 'status_change', 'Reported', 'Triaged', pmId, 'Triaged', new Date(Date.now() - 1000 * 60 * 60 * 90).toISOString());
  insertAssignment.run(r5Id, c1Id, new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(), pmId);
  insertTimeline.run(r5Id, 'assignment', null, 'Dave Miller', pmId, 'Assigned Dave', new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString());
  insertTimeline.run(r5Id, 'status_change', 'Triaged', 'Scheduled', pmId, 'Scheduled emergency visit', new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString());
  insertTimeline.run(r5Id, 'status_change', 'Scheduled', 'Resolved', c1Id, 'Cleared blockage with auger. Water flowing freely now.', new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString());

  // Request 6: Reopened (Resolved -> Triaged)
  const r6 = insertRequest.run(
    unitMap['202'],
    'Front balcony sliding door latch sticking',
    'Sliding door does not engage deadlock cleanly. Was previously resolved but jammed again during high humidity.',
    'low',
    'Triaged',
    pmId,
    new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
  );
  const r6Id = r6.lastInsertRowid as number;
  insertTimeline.run(r6Id, 'created', null, 'Reported', pmId, 'Initial report', new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString());
  insertTimeline.run(r6Id, 'status_change', 'Reported', 'Triaged', pmId, 'Triaged', new Date(Date.now() - 1000 * 60 * 60 * 100).toISOString());
  insertAssignment.run(r6Id, c3Id, new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(), pmId);
  insertTimeline.run(r6Id, 'assignment', null, 'Mike Rodriguez', pmId, 'Assigned Mike', new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString());
  insertTimeline.run(r6Id, 'status_change', 'Triaged', 'Scheduled', pmId, 'Scheduled adjustment', new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString());
  insertTimeline.run(r6Id, 'status_change', 'Scheduled', 'Resolved', c3Id, 'Lubricated track and adjusted strike plate', new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString());
  insertTimeline.run(r6Id, 'status_change', 'Resolved', 'Triaged', pmId, 'Reopened: Door still rubs against frame when temperatures rise', new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString());

  // 8. Insert historical resolved requests over past 8 weeks for dashboard chart
  for (let week = 1; week <= 8; week++) {
    const count = 2 + (week % 4); // 2 to 5 requests per week
    for (let j = 0; j < count; j++) {
      const daysAgo = week * 7 + j;
      const targetDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * daysAgo);
      const req = insertRequest.run(
        unitMap['101'],
        `Historical Maintenance Item W${week}-${j + 1}`,
        `Routine maintenance completed in week ${week} ago.`,
        'medium',
        'Resolved',
        pmId,
        targetDate.toISOString(),
        targetDate.toISOString()
      );
      const reqId = req.lastInsertRowid as number;
      const assignedContractor = j % 2 === 0 ? c1Id : c2Id;
      insertAssignment.run(reqId, assignedContractor, targetDate.toISOString(), pmId);
      insertTimeline.run(reqId, 'created', null, 'Reported', pmId, 'Logged', targetDate.toISOString());
      insertTimeline.run(reqId, 'status_change', 'Reported', 'Triaged', pmId, 'Triaged', targetDate.toISOString());
      insertTimeline.run(reqId, 'status_change', 'Triaged', 'Scheduled', pmId, 'Scheduled', targetDate.toISOString());
      insertTimeline.run(reqId, 'status_change', 'Scheduled', 'Resolved', assignedContractor, 'Work verified and completed', targetDate.toISOString());
    }
  }

  console.log('✅ Database seeded successfully!');
}

// Run standalone if executed directly
if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase();
}
