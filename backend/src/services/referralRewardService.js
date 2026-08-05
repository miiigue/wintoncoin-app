/**
 * Servicio Centralizado de Acreditación de Referidos y Bonos (Principio DRY)
 * 
 * Centraliza la lógica de recompensas por referido tanto para registros tradicionales
 * como para registros del Censo SOS Venezuela, garantizando que:
 * 1. Se vinculen los datos de genealogía en `users.referrer_id` y `referral_log`.
 * 2. Si el referente tiene una Causa Humanitaria Activa y Aprobada:
 *    - El bono se destina automáticamente como donación en espera ('on_hold') a su causa.
 *    - Se incrementa `pending_amount` de la causa.
 *    - Se envían notificaciones in-app, Push y correo electrónico transaccional.
 * 3. Si el referente no tiene causa activa:
 *    - El bono se acredita a su saldo impulsor en `booster_blue_ledger` vía `record_booster_event`.
 * 4. El nuevo usuario (referido / víctima) recibe su bono de bienvenida en `booster_blue_ledger`.
 */

const notificationService = require('./notificationService');
const { sendTransactionEmail } = require('./emailService');

async function processReferralReward({ client, newUser, referralCode }) {
    if (!referralCode || typeof referralCode !== 'string') {
        return { success: false, reason: 'NO_CODE' };
    }

    const cleanCode = referralCode.trim().toUpperCase();

    // 1. Consultar configuraciones del sistema
    const settingKeys = [
        'referral_system_enabled',
        'referral_reward_amount',
        'referral_reward_after_expiry',
        'welcome_bonus_enabled',
        'welcome_bonus_amount',
        'pre_launch_mode_enabled',
        'referral_codes_expiry_date'
    ];
    const settingsResult = await client.query(
        `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ANY($1::text[])`,
        [settingKeys]
    );
    const settings = settingsResult.rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});

    const preLaunchMode = settings.pre_launch_mode_enabled === 'true';
    const referralsEnabled = settings.referral_system_enabled === 'true';
    const welcomeBonusEnabled = settings.welcome_bonus_enabled === 'true';

    let referrer = null;
    let referralCodeExpired = false;

    if (referralsEnabled && cleanCode) {
        const referrerResult = await client.query('SELECT * FROM users WHERE UPPER(referral_code) = $1', [cleanCode]);
        if (referrerResult.rowCount > 0) {
            const expiryDateStr = settings.referral_codes_expiry_date;
            if (expiryDateStr) {
                const expiryDate = new Date(expiryDateStr);
                if (!isNaN(expiryDate.getTime())) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    expiryDate.setHours(0, 0, 0, 0);

                    if (today > expiryDate) {
                        referralCodeExpired = true;
                    } else {
                        referrer = referrerResult.rows[0];
                    }
                } else {
                    referrer = referrerResult.rows[0];
                }
            } else {
                referrer = referrerResult.rows[0];
            }
        }
    }

    // Notificar si el código de referido estaba expirado
    if (referralCodeExpired && cleanCode) {
        const expiryDateStr = settings.referral_codes_expiry_date;
        let expiryMsg = 'El código de referido que usaste ha expirado. Te has registrado exitosamente y recibirás el bono de bienvenida.';
        if (expiryDateStr) {
            const expiryDate = new Date(expiryDateStr);
            if (!isNaN(expiryDate.getTime())) {
                const formattedDate = expiryDate.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                expiryMsg = `El código de referido que usaste expiró el ${formattedDate}. Te has registrado exitosamente y recibirás el bono de bienvenida.`;
            }
        }
        await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [
            newUser.username,
            expiryMsg
        ]);
    }

    // 2. Procesar bonos si hay referente y el modo pre-lanzamiento está activo
    if (preLaunchMode && referrer) {
        const userCountRes = await client.query('SELECT COUNT(*) as count FROM users');
        const totalUsers = parseInt(userCountRes.rows[0].count, 10);

        const tierRes = await client.query(`
            SELECT reward_amount 
            FROM referral_reward_tiers 
            WHERE max_users_limit > $1 
            ORDER BY tier_number ASC 
            LIMIT 1
        `, [totalUsers]);

        let rewardAmount = 0;
        if (tierRes.rowCount > 0) {
            rewardAmount = parseFloat(tierRes.rows[0].reward_amount) || 0;
        } else {
            rewardAmount = parseFloat(settings.referral_reward_after_expiry) || 0;
        }

        if (rewardAmount > 0) {
            // Consultar si el referente tiene una causa humanitaria activa aprobada
            const causeCheck = await client.query(`
                SELECT id, title, evidence_urls, beneficiary_socials FROM humanitarian_causes 
                WHERE user_id = $1 AND status = 'approved' 
                LIMIT 1
            `, [referrer.id]);

            // VINCULACIÓN DE DATOS (GENEALOGÍA)
            await client.query('UPDATE users SET referrer_id = $1 WHERE id = $2', [referrer.id, newUser.id]);
            await client.query('INSERT INTO referral_log (referrer_user_id, referred_user_id) VALUES ($1, $2)', [referrer.id, newUser.id]);

            if (causeCheck.rowCount > 0) {
                const activeCause = causeCheck.rows[0];

                // CASO CON CAUSA ACTIVA: Desviar bono como donación 'on_hold'
                await client.query(`
                    INSERT INTO humanitarian_donations 
                        (cause_id, donor_id, recipient_id, amount, status, donation_type)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [activeCause.id, newUser.id, referrer.id, rewardAmount, 'on_hold', 'referral']);

                await client.query(`
                    UPDATE humanitarian_causes 
                    SET pending_amount = pending_amount + $1 
                    WHERE id = $2
                `, [rewardAmount, activeCause.id]);

                await client.query('UPDATE users SET is_booster = true WHERE id = $1', [referrer.id]);

                await client.query(`
                    INSERT INTO notifications (recipient_username, message) 
                    VALUES ($1, $2)
                `, [
                    referrer.username, 
                    `⚡ ¡Nuevo Referido! Tu bono de ${rewardAmount.toFixed(4)} BLUE por invitar a ${newUser.username} se ha destinado automáticamente como donación en espera para tu causa "${activeCause.title}". Estará disponible cuando el usuario verifique su KYC.`
                ]);

                await notificationService.sendNotificationToUser(referrer.id, {
                    title: 'Bono destinado a tu Causa 💙',
                    body: `${newUser.username} se unió con tu código. +${rewardAmount.toFixed(2)} BLUE IOU asignados en espera para tu causa.`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: `/causa-solidaria.html?id=${activeCause.id}` }
                }, 'TRANSACTIONAL');

                if (newUser.email) {
                    let creatorSocials = 'No especificadas';
                    try {
                        if (activeCause.evidence_urls) {
                            const urls = typeof activeCause.evidence_urls === 'string' ? JSON.parse(activeCause.evidence_urls) : activeCause.evidence_urls;
                            if (Array.isArray(urls) && urls.length > 1) {
                                creatorSocials = urls.slice(1).join(', ');
                            }
                        }
                    } catch (e) {
                        creatorSocials = 'No especificadas';
                    }
                    const beneficiarySocials = activeCause.beneficiary_socials || 'No especificadas';

                    sendTransactionEmail({
                        toEmail: newUser.email,
                        subject: '🎁 ¡Gracias por unirte! Tu registro apoya una causa — Winton Solidario',
                        title: 'Aporte Solidario por Registro',
                        message: `¡Bienvenido a Wintoncoin! Nos emociona mucho que te unas a nuestra comunidad. Queremos agradecerte de todo corazón porque al registrarte usando el código de referido de @${referrer.username}, has destinado tu bono de bienvenida de ${rewardAmount.toFixed(4)} BLUE IOU para apoyar la causa "${activeCause.title}". Tu granito de arena hace una gran diferencia.\n\nTu aporte está en resguardo seguro temporalmente. Para que este hermoso gesto se haga efectivo y sea liberado para la causa, solo debes completar tu verificación KYC Web3 en tu panel.`,
                        amount: `${rewardAmount.toFixed(4)} BLUE IOU`,
                        details: [
                            { label: 'Causa Solidaria', value: activeCause.title },
                            { label: 'Invitado por', value: `@${referrer.username}` },
                            { label: 'Donante', value: `@${newUser.username}` },
                            { label: 'Redes del Organizador', value: creatorSocials },
                            { label: 'Redes del Beneficiario', value: beneficiarySocials },
                            { label: 'Estado', value: 'En Resguardo Seguro (Falta KYC)' },
                            { label: 'Fecha', value: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) }
                        ]
                    }).catch(e => console.error('[SOLIDARIO CORREO] Error al enviar correo de bienvenida:', e.message));
                }

            } else {
                // CASO TRADICIONAL (Sin causa activa)
                await client.query("SELECT record_booster_event($1, 'referral_reward', $2, NULL, $3)", [referrer.id, rewardAmount, newUser.id]);
                await client.query('UPDATE users SET is_booster = true WHERE id = $1', [referrer.id]);

                await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus_sent', $2, $3)`, [referrer.id, rewardAmount, `Bono por referir a ${newUser.username}`]);
                await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3)`, [referrer.id, `Recompensa (perfil impulsor) por referir a ${newUser.username}`, rewardAmount]);
                await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [referrer.username, `¡Felicidades! Has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor porque ${newUser.username} se registró con tu código.`]);

                await notificationService.sendNotificationToUser(referrer.id, {
                    title: '¡Nuevo Referido! ⚡',
                    body: `${newUser.username} se unió con tu código. +${rewardAmount.toFixed(2)} BLUE IOU acreditados.`,
                    icon: '/assets/icons/icon-192x192.png',
                    data: { url: '/history.html' }
                }, 'TRANSACTIONAL');
            }

            // Bono para el nuevo usuario (referred)
            await client.query("SELECT record_booster_event($1, 'referral_reward', $2, NULL, $3)", [newUser.id, rewardAmount, referrer.id]);
            await client.query('UPDATE users SET is_booster = true WHERE id = $1', [newUser.id]);
            await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'referral_bonus_received', $2, $3)`, [newUser.id, rewardAmount, `Bono por usar el código de ${referrer.username}`]);
            await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'referral_bonus', $2, $3)`, [newUser.id, `Recompensa (perfil impulsor) por usar el código de ${referrer.username}`, rewardAmount]);
            await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [newUser.username, `¡Bienvenido! Por usar un código de referido, has ganado ${rewardAmount.toFixed(4)} BLUE en tu perfil de impulsor.`]);

            await notificationService.sendNotificationToUser(newUser.id, {
                title: '¡Bienvenido a la Familia! 🎁',
                body: `Has recibido ${rewardAmount.toFixed(2)} BLUE IOU de regalo por usar referido.`,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: '/history.html' }
            }, 'TRANSACTIONAL');
        }
    } else if (preLaunchMode && welcomeBonusEnabled) {
        // Bono de bienvenida general si no hay referente
        const welcomeBonusAmount = parseFloat(settings.welcome_bonus_amount) || 0;
        if (welcomeBonusAmount > 0) {
            await client.query('SELECT record_booster_event($1, \'welcome_bonus\', $2, NULL)', [newUser.id, welcomeBonusAmount]);
            await client.query('UPDATE users SET is_booster = true WHERE id = $1', [newUser.id]);
            await client.query(`INSERT INTO booster_transactions (user_id, type, amount, description) VALUES ($1, 'welcome_bonus', $2, $3)`, [newUser.id, welcomeBonusAmount, 'Bono de Bienvenida por registro']);
            await client.query(`INSERT INTO transactions (user_id, type, description, blue_change) VALUES ($1, 'welcome_bonus', $2, $3)`, [newUser.id, 'Bono de bienvenida (perfil impulsor)', welcomeBonusAmount]);
            await client.query(`INSERT INTO notifications (recipient_username, message) VALUES ($1, $2)`, [newUser.username, `¡Bienvenido! Has recibido ${welcomeBonusAmount.toFixed(4)} BLUE en tu perfil de impulsor como bono de bienvenida.`]);

            await notificationService.sendNotificationToUser(newUser.id, {
                title: '¡Bienvenido! 🚀',
                body: `Recibiste ${welcomeBonusAmount.toFixed(2)} BLUE IOU de regalo por tu registro.`,
                icon: '/assets/icons/icon-192x192.png',
                data: { url: '/history.html' }
            }, 'TRANSACTIONAL');
        }
    }

    return { success: true, referrer: referrer ? referrer.username : null };
}

module.exports = {
    processReferralReward
};
