"use strict";
module.exports={up:async client=>{await client.query("CREATE INDEX IF NOT EXISTS credit_policy_open_page ON credit_policy_issues(version_id,user_id) WHERE status<>'resolved'");},down:async()=>{throw Error('Revisar manualmente antes de retirar el índice operativo.');}};
