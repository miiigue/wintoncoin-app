"use strict";
const positive=v=>/^[1-9]\d{0,17}$/.test(String(v));
async function readRecoveryStatus(pool,query={}) {
 if(query.version!=null&&!positive(query.version)||query.after!=null&&!/^\d{1,18}$/.test(String(query.after)))throw Object.assign(Error('Filtro inválido.'),{status:400});
 const jobs=(await pool.query('SELECT * FROM credit_policy_jobs ORDER BY version_id DESC LIMIT 5')).rows;
 const currentVersion=jobs[0]?.version_id||null;
 const version=query.version||currentVersion;
 if(version && !(await pool.query('SELECT 1 FROM credit_policy_jobs WHERE version_id=$1',[version])).rowCount)throw Object.assign(Error('Política no encontrada.'),{status:404});
 const issues=version?(await pool.query(`SELECT i.version_id,i.user_id,i.status,i.reason,i.retry_requested,i.retry_count,i.max_retries,i.next_retry_at,i.updated_at,u.username
 FROM credit_policy_issues i LEFT JOIN users u ON u.id=i.user_id
 WHERE i.version_id=$1 AND i.status<>'resolved' AND i.user_id>$2 ORDER BY i.user_id LIMIT 26`,[version,query.after||'0'])).rows:[];
 const groups=version?(await pool.query(`SELECT status,reason,COUNT(*)::text AS count FROM credit_policy_issues
 WHERE version_id=$1 AND status<>'resolved' GROUP BY status,reason ORDER BY status,reason`,[version])).rows:[];
 const operations=(await pool.query(`SELECT o.id,o.kind,o.state,o.error_code,o.created_at FROM chain_operations o
 LEFT JOIN marketplace_payment_settlements s ON s.operation_id=o.id
 WHERE o.state IN ('pending','conflict','failed') OR (o.kind='marketplace' AND o.state='confirmed' AND s.operation_id IS NULL)
 ORDER BY o.created_at DESC LIMIT 25`)).rows;
 return {success:true,jobs,currentVersion,selectedVersion:version,historical:String(version)!==String(currentVersion),groups,
 issues:issues.slice(0,25),nextAfter:issues.length>25?String(issues[24].user_id):null,operations,operationsLimited:true};
}
module.exports={readRecoveryStatus};
