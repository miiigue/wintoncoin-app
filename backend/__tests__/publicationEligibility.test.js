const {publicationEligibility:check}=require('../src/services/publicationEligibility');
const now=Date.parse('2026-10-14T12:00:00Z');
const pub={available_slots:3,allow_repeat_participation:true,max_repeat_per_user:null,repeat_cooldown_hours:24};
const paid=at=>({status:'confirmed_paid',paid_recorded_at:at,created_at:'2020-01-01'});
test('no maximum means unlimited; cancelled history does not count',()=>{
 expect(check({...pub,repeat_cooldown_hours:0},[{status:'cancelled'},paid('2026-10-14')],now).allowed).toBe(true);
 expect(check({...pub,max_repeat_per_user:1},[paid('2026-10-14')],now).code).toBe('REPEAT_LIMIT');
});
test('cooldown begins at payment recording and permits exact boundary',()=>{
 expect(check(pub,[paid('2026-10-14T11:00:00Z')],now).code).toBe('REPEAT_COOLDOWN');
 expect(check(pub,[paid('2026-10-13T12:00:00Z')],now).allowed).toBe(true);
});
test('old missing date is not guessed; no cooldown does not require a date',()=>{
 expect(check(pub,[paid(null)],now).code).toBe('PAYMENT_DATE_REVIEW');
 expect(check({...pub,repeat_cooldown_hours:0},[paid(null)],now).allowed).toBe(true);
});
test.each([['is_paused',true,'PUBLICATION_PAUSED'],['available_slots',0,'NO_SLOTS'],['expires_at','2026-10-14T11:00:00Z','PUBLICATION_EXPIRED'],['allow_repeat_participation',false,'REPEAT_DISABLED']])('honors %s', (field,value,code)=>expect(check({...pub,[field]:value},[paid('2026-10-10')],now).code).toBe(code));
test('active or rejected participation cannot repeat',()=>{
 expect(check(pub,[{status:'approved'}],now).code).toBe('ACTIVE_PARTICIPATION');
 expect(check(pub,[{status:'rejected'}],now).code).toBe('PARTICIPATION_REJECTED');
});
