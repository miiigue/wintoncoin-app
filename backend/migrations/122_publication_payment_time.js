"use strict";
async function up(client){
 await client.query(`ALTER TABLE publication_acceptances ADD COLUMN IF NOT EXISTS paid_recorded_at TIMESTAMPTZ;
 -- Recover only an evidenced settlement date; never substitute the request date.
 UPDATE publication_acceptances pa SET paid_recorded_at=e.applied_at
 FROM (SELECT o.payload->>'acceptanceId' AS acceptance_id, MIN(s.applied_at) AS applied_at
       FROM marketplace_payment_settlements s JOIN chain_operations o ON o.id=s.operation_id
       WHERE o.kind='marketplace' AND o.state='confirmed'
       GROUP BY o.payload->>'acceptanceId') e
 WHERE pa.id::text=e.acceptance_id AND pa.status='confirmed_paid' AND pa.paid_recorded_at IS NULL;
 CREATE OR REPLACE FUNCTION stamp_publication_payment_time() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
  IF TG_OP='INSERT' THEN
   NEW.paid_recorded_at := CASE WHEN NEW.status='confirmed_paid' THEN clock_timestamp() ELSE NULL END;
  ELSIF OLD.status IS DISTINCT FROM 'confirmed_paid' AND NEW.status='confirmed_paid' THEN
   NEW.paid_recorded_at := COALESCE(OLD.paid_recorded_at, clock_timestamp());
  ELSE
   NEW.paid_recorded_at := OLD.paid_recorded_at;
  END IF;
  RETURN NEW;
 END $$;
 DROP TRIGGER IF EXISTS publication_payment_time ON publication_acceptances;
 CREATE TRIGGER publication_payment_time BEFORE INSERT OR UPDATE ON publication_acceptances
 FOR EACH ROW EXECUTE FUNCTION stamp_publication_payment_time();`);
}
module.exports={up,down:async()=>{throw Error('No se elimina automáticamente la fecha auditable de los pagos.');}};
