'use strict';
// Shared UTC budget: sponsored wallet funding and institutional payment fees.
// A failed mined payment still consumes gas; its reservation remains counted.
async function usage(client,chainId,userId){
 return (await client.query(`SELECT COALESCE(SUM((payload->>'reservedWei')::numeric),0)::text AS total,
 COUNT(DISTINCT COALESCE(payload->>'parentId',id::text)) FILTER
 (WHERE user_id=$1 OR (kind='marketplace' AND payload->>'payerId'=$1::text))::integer AS user_count
 FROM chain_operations WHERE chain_id=$2 AND
 ((kind='gas' AND created_at >= date_trunc('day',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') OR
 (kind='marketplace' AND jsonb_array_length(steps)>0 AND payload->>'gasBudgetDay'=to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD')))`,[userId,chainId])).rows[0];
}
module.exports={usage};
