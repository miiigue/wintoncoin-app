'use strict';
// Shared UTC budget: sponsored wallet funding and institutional payment fees.
// A failed mined payment still consumes gas; its reservation remains counted.
async function usage(client,chainId,userId,currentOperationId=null){
 return (await client.query(`SELECT COALESCE(SUM((payload->>'reservedWei')::numeric),0)::text AS total,
 COUNT(DISTINCT COALESCE(payload->>'parentId',id::text)) FILTER
 (WHERE (user_id=$1 OR (kind='marketplace' AND payload->>'payerId'=$1::text)) AND ($3::uuid IS NULL OR id<>$3::uuid))::integer AS user_count
 FROM chain_operations WHERE chain_id=$2 AND
 ((kind IN ('gas','settleMatured') AND (created_at >= date_trunc('day',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
     OR state IN ('pending','conflict'))) OR
 ((kind='marketplace' AND jsonb_array_length(steps)>0 OR payload->>'sponsoredAccount'='true') AND
     (payload->>'gasBudgetDay'=to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD') OR state IN ('pending','conflict'))))`,[userId,chainId,currentOperationId])).rows[0];
}
module.exports={usage};
