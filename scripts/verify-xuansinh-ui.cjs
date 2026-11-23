// Build first. API fixtures only; no live account, DB or message delivery.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];const posts=[];const merges=[];const assignments=[];const swaps=[];const scopes=[];const complaintQueries=[];const schedules=[];const charges=[];let role='VETERINARIAN';let staleSlot=false;
    const invoice={id:'invoice',horseId:'h',horse:{id:'h',name:'QA horse',horseCode:'H-QA',breed:'QA'},ownerId:'v',owner:{id:'v',fullName:'QA owner',email:'owner@example.test'},billingPeriod:'2026-10',billingMethod:'ACTUAL_USAGE',boardingFee:0,trainingFee:0,medicalFee:11250,prizeCredit:0,netAmount:11250,status:'SENT',createdAt:'2026-11-01',updatedAt:'2026-11-01',lineItems:[{id:'line',careCostEntryId:'entry',entryType:'CONSUMPTION',recordNumber:'BA-QA',prescribedAt:'2026-10-01T00:00Z',performedAt:'2026-10-02T00:00Z',veterinarianName:'Assigned QA Vet',supplyName:'<img src=x onerror=alert(1)>',quantity:'0.125',unit:'PILL',unitPrice:'90000',amount:'11250'}]};
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')console.error('BROWSER',m.text());});
    page.setDefaultTimeout(12000);
    const record={id:'rec',recordNumber:'MED-QA',horseId:'h',horseName:'QA horse',status:'OPEN',severity:'SEVERE',examinationDate:'2026-11-23T03:00:00Z',examinationType:'Routine Clinical',examinationReason:'QA clinical evaluation',diagnosis:'QA injury',vitals:{},prescriptions:[],treatmentPhases:[],followUps:[],labTests:[]};
    await page.route('**/*',async route=>{
      const req=route.request();const url=new URL(req.url());const p=url.pathname;
      if(!p.startsWith('/api/')){
        if(url.hostname!=='tmec.test')return route.abort();
        let f=path.join(process.cwd(),'dist',p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(process.cwd(),'dist/index.html');
        return route.fulfill({contentType:{'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'}[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});
      }
      let data=[];
      if(p.endsWith('/auth/me'))data={id:'v',fullName:'QA Vet',email:'vet@example.test',role,status:'ACTIVE',permissions:{viewMedical:true,viewHorses:true,assignSchedule:true,viewTraining:true,manageAccounts:true},notify:{}};
      else if(p==='/api/training/tracks')data=[{id:'track',code:'A',name:'QA physical track',surface:'TURF',capacity:6,isActive:true}];
      else if(p==='/api/accounts')data={accounts:[]};
      else if(p==='/api/invoices/care-billing-policy')data={cutoverPeriod:'2026-10',examUnitPrice:'500000'};
      else if(p.endsWith('/rec/exam-charge')){charges.push(req.postDataJSON());data={id:'exam',amount:'500000'};}
      else if(p==='/api/invoices/owner-summary')data={outstandingDebt:11250,totalBoarding:0,totalMedical:11250,totalTraining:0,totalExpense:11250,totalPrizeCredit:0,totalNet:11250,invoiceCount:1,invoices:[invoice]};
      else if(p==='/api/training/workouts' && req.method()==='GET')data=[];
      else if(p==='/api/training/plans/plan')data={id:'plan',horseId:'h',phaseName:'QA training plan',status:'ACTIVE',startDate:'2026-11-24',endDate:'2026-12-05',createdAt:'2026-11-23',trainer:{id:'v',fullName:'QA trainer',status:'ACTIVE'},horse:{id:'h',name:'QA horse',status:'ACTIVE'},phases:[{id:'phase',name:'Base',type:'BASE',surface:'TURF',startDate:'2026-11-24',endDate:'2026-12-05',sessionsPerWeek:5,maxWeeklyDistance:10000}],workoutSessions:[]};
      else if(p.endsWith('/check-workout'))data={available:true,warnings:[]};
      else if(p.endsWith('/suggest-slots')){staleSlot=false;data={slots:[{startAt:'2026-11-24T00:15:00Z',endAt:'2026-11-24T01:15:00Z',trackId:'track',availableCapacity:1,reasons:[]}],reasons:[]};}
      else if(p==='/api/training/plans/plan/workouts' && req.method()==='POST'){schedules.push(req.postDataJSON());if(staleSlot)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({success:false,code:'TRACK_CAPACITY_EXCEEDED',message:'The selected track is now full. Suggest slots again.'})});data={id:'workout'};}
      else if(p==='/api/shift-rosters/care-team'){scopes.push(url.searchParams.get('scope'));data={groomRosters:[],responsibleVeterinarians:[{id:'vet',fullName:'Assigned QA Vet',horses:[{id:'h',name:'QA horse'}]}]};}
      else if(p==='/api/complaints'){complaintQueries.push(url.search);data={items:[],total:0};}
      else if(p==='/api/complaints/subjects')data=[];
      else if(p==='/api/shifts')data=[{id:'shift',code:'M',name:'Morning',startTime:'07:00',endTime:'13:00',isOvernight:false,isActive:true,sortOrder:1}];
      else if(p==='/api/shift-rosters')data=[{id:'own-roster',date:'2026-11-24',shiftId:'shift',zoneId:'z',groomUserId:'v',groom:{id:'v',fullName:'My Groom',role:'GROOM',status:'ACTIVE',email:'g@example.test'},shift:{id:'shift',name:'Morning',startTime:'07:00',endTime:'13:00',isActive:true,isOvernight:false},zone:{id:'z',name:'Zone A',code:'A'}},{id:'colleague-roster',date:'2026-11-25',shiftId:'shift',zoneId:'z',groomUserId:'g',groom:{id:'g',fullName:'Colleague Groom',role:'GROOM',status:'ACTIVE',email:'c@example.test'},shift:{id:'shift',name:'Morning',startTime:'07:00',endTime:'13:00',isActive:true,isOvernight:false},zone:{id:'z',name:'Zone A',code:'A'}}];
      else if(p==='/api/shift-rosters/my')data=[];
      else if(p.endsWith('/swap-candidates'))data=[{id:'g',fullName:'Colleague Groom'}];
      else if(p.endsWith('/swap-request')){swaps.push({path:p,...req.postDataJSON()});data={requested:true};}
      else if(p==='/api/stalls/zones')data=[{id:'z',code:'A',name:'Zone A',rows:1,cols:1,isActive:true}];
      else if(p==='/api/stalls')data=[{id:'s',code:'A-01',zone:'Zone A',zoneId:'z',row:1,col:1,status:'OCCUPIED',zoneRef:{id:'z',code:'A',name:'Zone A',rows:1,cols:1,isActive:true},allocations:[{id:'alloc',isActive:true,horseId:'h',horse:{id:'h',name:'QA horse',status:'ACTIVE',horseCode:'H-QA'}}]}];
      else if(p.endsWith('/alloc/groom-candidates'))data=[{id:'g',fullName:'QA on-duty Groom'}];
      else if(p.endsWith('/alloc/groom')){assignments.push(req.postDataJSON());data={id:'alloc',careSyncFailed:false,notificationFailed:false};}
      else if(p==='/api/medical/locks')data={data:[{id:'lock',lockCode:'KH-QA',horseId:'h',medicalRecordId:'rec',isLocked:true,lockReason:'QA protective lock',lockedAt:'2026-11-23T03:00:00Z',source:'INCIDENT_AUTO',veterinarian:null}],total:1};
      else if(p==='/api/medical/records/rec')data=record;
      else if(p.endsWith('/rec/close')){posts.push(req.postDataJSON());Object.assign(record,{status:'CLOSED',treatmentResult:'RECOVERED',isMedicalLocked:true,horseStatus:'INJURED'});data=record;}
      else if(p==='/api/incidents')data={items:[{id:'inc',incidentNumber:'INC-QA',horseId:'h',horse:{id:'h',name:'QA horse',status:'INJURED',isMedicalLocked:true},reportedById:'g',status:'UNDER_REVIEW',severity:'SEVERE',description:'QA clinical observation',symptomsJson:['LAMENESS'],medicalRecordId:'rec',createdAt:new Date().toISOString()}],total:1,page:1,limit:20};
      else if(p.endsWith('/duplicate-candidates'))data=[{id:'child',incidentNumber:'INC-CHILD',horseId:'h',status:'REPORTED',severity:'SEVERE',description:'Related observation',createdAt:new Date().toISOString()}];
      else if(p.endsWith('/inc/resolve')){merges.push(req.postDataJSON());data={id:'inc',status:'RESOLVED',medicalRecordId:'rec',mergedCount:1};}
      else if(p.includes('/notifications'))data={items:[],total:0,unreadCount:0};
      return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data})});
    });
    await page.goto('http://tmec.test/medical/records/rec');
    await page.getByText('QA protective lock',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Conclude Treatment',exact:true}).click();
    const modal=page.getByRole('dialog');
    await modal.getByRole('textbox').fill('Clinical recovery confirmed in follow-up.');
    const submit=modal.getByRole('button',{name:'Save Conclusion & Close Record'});
    assert.equal(await submit.isDisabled(),true);
    assert.equal(posts.length,0);
    await modal.getByRole('checkbox').check();
    await submit.click();
    await page.getByText('Other medical locks remain active.').waitFor();
    assert.equal(posts.length,1);
    assert.deepEqual({recoveryConfirmed:posts[0].recoveryConfirmed,postTreatmentStatus:posts[0].postTreatmentStatus,treatmentResult:posts[0].treatmentResult},{recoveryConfirmed:true,postTreatmentStatus:'RESTING',treatmentResult:'RECOVERED'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.goto('http://tmec.test/incidents');
    await page.getByTestId('incident-card-review-btn').click();
    await page.getByLabel(/INC-CHILD/).waitFor();
    assert.equal(await page.locator('[data-testid="incident-status-select"] option[value="RESOLVED"]').count(),0);
    const mergeButton=page.getByRole('button',{name:'Resolve and merge selected reports'});
    assert.equal(await mergeButton.isDisabled(),true);
    await page.getByLabel(/INC-CHILD/).check();
    await page.getByLabel('I confirm recovery and that the selected reports belong to this treatment episode.').check();
    await mergeButton.click();
    await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
    assert.equal(merges.length,1);
    assert.deepEqual(merges[0].duplicateIncidentIds,['child']);
    assert.equal(merges[0].recoveryConfirmed,true);
    assert.equal(await page.getByRole('link',{name:'Training Locks',exact:true}).count(),0);
    role='CLUB_MANAGER';
    await page.goto('http://tmec.test/stalls?assignGroom=alloc');
    const assignmentDialog=page.getByRole('dialog');
    await assignmentDialog.getByText('Only active Grooms currently on duty in this barn zone can be selected.').waitFor();
    await assignmentDialog.locator('select').selectOption('g');
    await assignmentDialog.getByRole('button',{name:'Assign Groom',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('#allocation-groom-form'));
    assert.deepEqual(assignments,[{groomUserId:'g'}]);
    role='GROOM';
    await page.clock.install({time:new Date('2026-11-23T03:00:00Z')});
    await page.setViewportSize({width:1280,height:900});
    await page.goto('http://tmec.test/stable/shifts');
    await page.getByText('Weekly Shift Roster',{exact:true}).waitFor();
    assert.ok(await page.getByRole('link',{name:'Open today’s checklist',exact:true}).count());
    await page.locator('[data-own-shift="true"]').click();
    const shiftDialog=page.getByRole('dialog');
    await shiftDialog.locator('select').last().selectOption('g');
    await shiftDialog.getByRole('textbox').fill('Please cover my future shift.');
    await shiftDialog.getByRole('button',{name:'Request this shift change',exact:true}).click();
    await shiftDialog.getByText('Request recorded. Current assignments remain in force until the club manager updates them.').waitFor();
    assert.equal(swaps.length,1);assert.equal(swaps[0].targetGroomUserId,'g');
    await page.goto('http://tmec.test/stable/my-shift');
    await page.getByRole('heading',{name:'My shift',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Request swap',exact:true}).count(),0);
    role='HEAD_TRAINER';
    await page.goto('http://tmec.test/stable/shifts');
    await page.getByText('Assigned QA Vet',{exact:true}).waitFor();
    assert.equal(scopes.at(-1),'mine');
    await Promise.all([page.waitForResponse(r=>r.url().includes('/care-team?')&&r.url().includes('scope=club')),page.getByRole('checkbox',{name:'My horses’ care team',exact:true}).uncheck()]);
    assert.equal(scopes.at(-1),'club');
    await page.goto('http://tmec.test/training/plans/plan?status=ALL');
    await page.getByRole('button',{name:'+ Add workout',exact:true}).click();
    const workout=page.getByRole('dialog');
    await workout.getByRole('button',{name:'Suggest three training slots',exact:true}).click();
    await Promise.all([page.waitForResponse(r=>r.url().endsWith('/check-workout')),workout.getByRole('button',{name:/QA physical track/}).click()]);
    const save=workout.getByRole('button',{name:/^Save|^Add workout/}).last();
    await save.waitFor();
    staleSlot=true;
    await save.click();
    await workout.getByText('Cannot save',{exact:true}).waitFor();
    assert.ok((await workout.innerText()).includes('The selected track is now full. Suggest slots again.'));
    assert.equal(schedules.length,1);assert.equal(schedules[0].trackId,'track');assert.equal(schedules[0].scheduledDate,'2026-11-24T07:15:00+07:00');
    await workout.getByRole('button',{name:'Suggest three training slots',exact:true}).click();
    await workout.getByRole('button',{name:/QA physical track/}).waitFor();
    role='CLUB_MANAGER';
    await page.goto('http://tmec.test/catalogs/training-tracks');
    await page.getByRole('heading',{name:'Physical training tracks',exact:true}).waitFor();
    await page.getByRole('button',{name:/QA physical track/}).click();
    assert.equal(await page.getByLabel('Maximum simultaneous horses').getAttribute('max'),'6');
    await page.goto('http://tmec.test/complaints');
    await page.getByLabel('Reporter role (independent handling)').selectOption('GROOM');
    await Promise.all([page.waitForResponse(r=>r.url().includes('/complaints?')&&r.url().includes('targetRole=HEAD_TRAINER')),page.getByLabel('Subject role').selectOption('HEAD_TRAINER')]);
    assert.ok(complaintQueries.at(-1).includes('reporterRole=GROOM'));
    role='GROOM';await page.goto('http://tmec.test/complaints');
    await page.getByLabel('Subject role').waitFor();
    assert.equal(await page.getByLabel('Reporter role (independent handling)').count(),0);
    role='CLUB_MANAGER';
    await page.goto('http://tmec.test/medical/records/rec');
    await page.getByRole('button',{name:/Record examination charge/}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Record charge',exact:true}).click();
    await page.getByText(/Examination charge recorded/).waitFor();assert.equal(charges.length,1);
    await page.goto('http://tmec.test/financial-reports');
    await page.getByText('Actual medical usage billing settings',{exact:true}).click();
    assert.equal(await page.getByLabel('First month of actual usage billing').isDisabled(),true);
    role='HORSE_OWNER';
    await page.goto('http://tmec.test/owner/financial-reports');
    await page.getByRole('button',{name:'Statement',exact:true}).click();
    const statement=page.getByRole('dialog');
    await statement.getByRole('region',{name:'Medical usage appendix'}).waitFor();
    await statement.getByText('<img src=x onerror=alert(1)>',{exact:true}).waitFor();
    assert.equal(await page.locator('img[src="x"]').count(),0);
    assert.equal(await page.getByText('Actual medical usage billing settings',{exact:true}).count(),0);
    const [download]=await Promise.all([page.waitForEvent('download'),statement.getByRole('button',{name:'Export Excel',exact:true}).click()]);
    const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
    const exported=Buffer.concat(chunks).toString('utf8');assert.ok(exported.includes('&lt;img'));assert.ok(exported.includes('11250'));assert.ok(!exported.includes('<f>'));
    await page.evaluate(()=>{const original=Node.prototype.appendChild;Node.prototype.appendChild=function(child){const added=original.call(this,child);if(child instanceof HTMLIFrameElement&&child.contentWindow)child.contentWindow.print=()=>{window.__printedStatement=child.contentDocument.documentElement.outerHTML;};return added;};});
    await statement.getByRole('button',{name:'Export PDF',exact:true}).click();
    const printed=await page.evaluate(()=>window.__printedStatement);assert.ok(printed.includes('Medical usage appendix'));assert.ok(printed.includes('&lt;img'));assert.ok(!printed.includes('<img src="x"'));
    assert.deepEqual(errors,[]);
    console.log('PASS: medical recovery and selected merge; manager assignment; Groom weekly/Today; HT scoped care team + responsible Vet; training slot selection and stale submit; track catalog; role filters; mobile layout and page errors. API fixtures only.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
