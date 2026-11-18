import React, { useState } from 'react';
import { administerContract } from '../modules/ownerWalletAdministration.js';
import styles from '../pages/AdminWeb3Panel.module.css';

/**
 * V6EmergencyControl.jsx
 * Panel de Control de Emergencia (Circuit Breaker) oficial para la Suite V6.
 *
 * Principios de Seguridad Bancaria y FinTech (Zero-Trust / SOC 2):
 * - Gobierna los 18 contratos V6 de forma atómica a través de `ProtocolModeController.setMode(uint8)`.
 * - El servidor nunca posee claves privadas; toda transición exige firma directa de la billetera propietaria.
 * - Exige frase de confirmación exacta + diálogo de seguridad antes de abrir la billetera,
 *   previniendo activaciones accidentales.
 * - Distingue claramente entre:
 *     * Nivel 1 (`EMERGENCY_EXIT_ONLY`): detiene operaciones económicas y nuevos compromisos RED,
 *       permitiendo evacuación ordenada de fondos.
 *     * Nivel 2 (`PRELAUNCH_FROZEN`): congelamiento total absoluto, bloqueando incluso
 *       cualquier retiro de USDT (`ExitsNotAllowed` / `OperationsFrozen`).
 *     * Recuperación (`NORMAL`): restablece la operación regular tras auditoría.
 */

const MODE_META = {
  NORMAL: {
    badge: '🟢 NORMAL (Operación Activa)',
    color: '#4ade80',
    border: '#16a34a',
    bg: 'rgba(22, 163, 74, 0.12)',
    summary: 'Todos los módulos V6 (Exchange FIFO, Pagos, Bóveda y Tesorería) operan en modo normal.'
  },
  EMERGENCY_EXIT_ONLY: {
    badge: '🟠 NIVEL 1: EMERGENCY_EXIT_ONLY (Parada Económica)',
    color: '#fbbf24',
    border: '#d97706',
    bg: 'rgba(217, 119, 6, 0.14)',
    summary: 'Operaciones económicas detenidas (sin nuevas órdenes, pagos ni nuevos compromisos RED). Los retiros ordenados siguen permitidos.'
  },
  PRELAUNCH_FROZEN: {
    badge: '🔴 NIVEL 2: PRELAUNCH_FROZEN (Congelamiento Total Absoluto)',
    color: '#f87171',
    border: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.15)',
    summary: 'BLOQUEO TOTAL ON-CHAIN: todas las operaciones y todos los retiros de USDT están congelados hasta nueva orden del propietario.'
  }
};

const ACTIONS = [
  {
    key: 'v6_mode_emergency_exit',
    targetMode: 'EMERGENCY_EXIT_ONLY',
    title: 'Nivel 1 — Pausar Operaciones Económicas (EMERGENCY_EXIT_ONLY)',
    description: 'Detiene compras, ventas, pagos y generación de nuevos compromisos RED. Permite retiros ordenados si las bóvedas de USDT no están comprometidas.',
    phrase: 'PAUSAR OPERACIONES V6',
    buttonLabel: 'Activar Nivel 1 (Parada Económica)',
    accent: '#d97706',
    confirmPrompt: '¿Confirmas activar el NIVEL 1 (EMERGENCY_EXIT_ONLY) en ProtocolModeController? Se detendrán las operaciones económicas en los 18 contratos V6.'
  },
  {
    key: 'v6_mode_freeze_all',
    targetMode: 'PRELAUNCH_FROZEN',
    title: 'Nivel 2 — Congelamiento Total Absoluto (PRELAUNCH_FROZEN)',
    description: 'MÁXIMA CONTENCIÓN: bloquea absolutamente todo en la blockchain, incluyendo cualquier retiro de USDT (ExitsNotAllowed). Usar solo ante compromiso crítico de fondos o ataque activo.',
    phrase: 'CONGELAR TODO V6',
    buttonLabel: '🚨 Activar Nivel 2 (Congelar Todo + USDT)',
    accent: '#dc2626',
    confirmPrompt: '⚠️ ATENCIÓN MÁXIMA: ¿Confirmas activar el CONGELAMIENTO TOTAL (PRELAUNCH_FROZEN)? Esto bloqueará absolutamente todas las operaciones e impedirá cualquier retiro de USDT hasta que el propietario reactive el protocolo.'
  },
  {
    key: 'v6_mode_normal',
    targetMode: 'NORMAL',
    title: 'Recuperación — Restablecer Operación Normal (NORMAL)',
    description: 'Reactiva los 18 contratos de la suite V6 tras completar la investigación y auditoría de seguridad.',
    phrase: 'REACTIVAR V6 NORMAL',
    buttonLabel: 'Restablecer Modo NORMAL',
    accent: '#16a34a',
    confirmPrompt: '¿Confirmas restablecer ProtocolModeController a modo NORMAL (0)? Asegúrate de haber validado la seguridad antes de firmar.'
  }
];

export default function V6EmergencyControl({
  currentMode,
  loadingStatus,
  actionLoading,
  setActionLoading,
  setLastOwnerOperation,
  showToast,
  onModeChanged
}) {
  const [selectedActionKey, setSelectedActionKey] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [progress, setProgress] = useState('');

  const normalizedMode = MODE_META[currentMode] ? currentMode : null;
  const meta = normalizedMode ? MODE_META[normalizedMode] : null;
  const selectedAction = ACTIONS.find((item) => item.key === selectedActionKey) || null;
  const availableActions = ACTIONS.filter((item) => item.targetMode !== normalizedMode);

  const handleSelectAction = (actionKey) => {
    setSelectedActionKey((prev) => (prev === actionKey ? '' : actionKey));
    setConfirmationText('');
  };

  const handleExecute = async () => {
    if (!selectedAction || !normalizedMode) return;
    if (confirmationText.trim() !== selectedAction.phrase) {
      showToast?.('❌ Escribe la frase de confirmación exactamente como se indica.');
      return;
    }
    const accepted = window.confirm(selectedAction.confirmPrompt);
    if (!accepted) return;

    setActionLoading(true);
    setProgress(`Preparando firma propietaria para ${selectedAction.targetMode}…`);
    try {
      const result = await administerContract(selectedAction.key, {});
      setLastOwnerOperation?.(result);
      if (!result.success) {
        if (result.pending) {
          throw new Error(`Operación pendiente en blockchain. Conserva la referencia ${result.operationId || 'mostrada arriba'} y no repitas la firma.`);
        }
        throw new Error(result.message || 'No se pudo confirmar el cambio de modo en ProtocolModeController.');
      }
      setConfirmationText('');
      setSelectedActionKey('');
      setProgress('Verificando el nuevo modo en blockchain…');
      await onModeChanged?.();
      showToast?.(`✅ ProtocolModeController confirmado en modo ${selectedAction.targetMode}.`);
    } catch (error) {
      showToast?.(`❌ ${error.message}`);
      await onModeChanged?.();
    } finally {
      setProgress('');
      setActionLoading(false);
    }
  };

  return (
    <div className={styles.actionPanel}>
      <h3 className={styles.actionPanelTitle}>🛡️ Control de Emergencia V6 (ProtocolModeController)</h3>
      <p className={styles.actionPanelDesc}>
        Interruptor atómico único para los 18 contratos V6. Una sola firma de la billetera propietaria gobierna
        simultáneamente el Exchange FIFO, Pagos, Bóveda de Garantías y Tesorería. El servidor nunca almacena claves privadas.
      </p>

      {/* Indicador del modo actual verificado on-chain */}
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: '0.85rem 1rem',
          borderRadius: '0.5rem',
          border: `1px solid ${meta ? meta.border : '#64748b'}`,
          backgroundColor: meta ? meta.bg : 'rgba(100, 116, 139, 0.14)',
          marginBottom: '1rem'
        }}
      >
        <div style={{ fontWeight: 700, color: meta ? meta.color : '#facc15', marginBottom: '0.25rem' }}>
          {meta ? meta.badge : '⚠️ Estado on-chain no verificado'}
        </div>
        <div style={{ fontSize: '0.875rem', opacity: 0.92 }}>
          {meta
            ? meta.summary
            : 'No se pudo confirmar el modo actual en ProtocolModeController. Refresca el panel antes de operar.'}
        </div>
      </div>

      {/* Selector de niveles de emergencia / recuperación */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {availableActions.map((action) => {
          const isSelected = selectedActionKey === action.key;
          return (
            <div
              key={action.key}
              style={{
                border: `1px solid ${isSelected ? action.accent : 'rgba(148, 163, 184, 0.25)'}`,
                borderRadius: '0.5rem',
                padding: '0.85rem',
                backgroundColor: isSelected ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.35)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{action.title}</strong>
                <button
                  type="button"
                  onClick={() => handleSelectAction(action.key)}
                  disabled={actionLoading || loadingStatus || !normalizedMode}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${action.accent}`,
                    backgroundColor: isSelected ? action.accent : 'transparent',
                    color: '#f8fafc',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {isSelected ? 'Cancelar selección' : 'Seleccionar'}
                </button>
              </div>
              <p className={styles.actionPanelDesc} style={{ marginTop: '0.5rem', marginBottom: isSelected ? '0.75rem' : 0 }}>
                {action.description}
              </p>

              {isSelected && (
                <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                  <label className={styles.formLabel} htmlFor={`v6-mode-confirm-${action.key}`}>
                    Para habilitar escribe: <strong>{action.phrase}</strong>
                  </label>
                  <input
                    id={`v6-mode-confirm-${action.key}`}
                    className={styles.formInput}
                    value={confirmationText}
                    onChange={(event) => setConfirmationText(event.target.value)}
                    autoComplete="off"
                    spellCheck="false"
                    placeholder={action.phrase}
                    disabled={actionLoading}
                  />
                  <button
                    type="button"
                    className={styles.submitBtn}
                    style={{ backgroundColor: action.accent, borderColor: action.accent }}
                    disabled={actionLoading || loadingStatus || confirmationText.trim() !== action.phrase}
                    onClick={handleExecute}
                  >
                    {actionLoading ? 'Procesando firma…' : action.buttonLabel}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {progress && (
        <p role="status" aria-live="assertive" style={{ marginTop: '0.75rem', fontWeight: 600 }}>
          {progress}
        </p>
      )}
    </div>
  );
}
