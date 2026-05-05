// ============================================================================
// WintonCoin - Página de Estado de Cuenta Web3
// ============================================================================

import { getApiUrl, showCustomAlert, handleSessionExpired } from '../modules/index.js';

async function initializeEstadoCuenta() {
    const API_URL = getApiUrl();
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const elements = {
        loading: document.getElementById('web3Loading'),
        content: document.getElementById('web3Data'),
        publicKey: document.getElementById('publicKeyDisplay'),
        copyBtn: document.getElementById('copyPublicKeyBtn'),
        blueAvailable: document.getElementById('blueAvailable'),
        blueEscrow: document.getElementById('blueEscrow'),
        blueUnlockDate: document.getElementById('blueUnlockDate'),
        fiatEquivalency: document.getElementById('fiatEquivalency'),
        redCreditLimit: document.getElementById('redCreditLimit'),
        redCreditAvailable: document.getElementById('redCreditAvailable'),
        redDebtTotal: document.getElementById('redDebtTotal'),
        redDebt30Days: document.getElementById('redDebt30Days'),
        redDebtEndMonth: document.getElementById('redDebtEndMonth'),
        redNextDueDate: document.getElementById('redNextDueDate'),
        statInteractions: document.getElementById('statInteractions'),
        statReceived: document.getElementById('statReceived'),
        statSent: document.getElementById('statSent'),
        statBurned: document.getElementById('statBurned'),
        explorerLinkBtn: document.getElementById('explorerLinkBtn'),
        txHistoryContainer: document.getElementById('txHistoryContainer'),
        
        // Smart Contract Modals
        scBlueBtn: document.getElementById('scBlueBtn'),
        scRedBtn: document.getElementById('scRedBtn'),
        scModal: document.getElementById('scModal'),
        scModalClose: document.getElementById('scModalClose'),
        scModalTitle: document.getElementById('scModalTitle'),
        scModalAddress: document.getElementById('scModalAddress'),
        scModalMinted: document.getElementById('scModalMinted'),
        scModalExplorer: document.getElementById('scModalExplorer')
    };

    function formatBalance(val) {
        const num = Number(val) || 0;
        return num.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    }

    try {
        // Obtenemos los balances del usuario desde el backend
        const response = await fetch(`${API_URL}/api/me/balance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (handleSessionExpired(response)) return;
        
        if (!response.ok) throw new Error('Error al cargar datos Web3');
        const data = await response.json();

        // 1. Identidad Web3
        const address = data.web3_wallet_address || localStorage.getItem('myWalletAddress');
        const isValidAddress = address && address.startsWith('0x') && address.length > 10;
        
        elements.publicKey.textContent = isValidAddress ? address : '0xPendienteDeAsignacion...';
        
        elements.copyBtn.addEventListener('click', () => {
            if(!isValidAddress) return;
            navigator.clipboard.writeText(address);
            elements.copyBtn.textContent = 'Copiado ✓';
            elements.copyBtn.style.background = 'rgba(16, 185, 129, 0.4)';
            elements.copyBtn.style.color = '#fff';
            setTimeout(() => {
                elements.copyBtn.textContent = 'Copiar';
                elements.copyBtn.style.background = '';
                elements.copyBtn.style.color = '';
            }, 2000);
        });

        // 2. Liquidez BLUE
        const available = parseFloat(data.blue_balance) || 0;
        const escrow = parseFloat(data.escrow_blue_balance) || 0;
        elements.blueAvailable.textContent = `${formatBalance(available)} BLUE`;
        elements.blueEscrow.textContent = `${formatBalance(escrow)} BLUE`;
        // La equivalencia se calcula como 1 BLUE = 1 USD (2 decimales)
        const fiatTotal = available + escrow;
        elements.fiatEquivalency.textContent = `≈ $${fiatTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
        
        if (escrow > 0 && data.next_unlock_at) {
            const nextUnlock = new Date(data.next_unlock_at);
            elements.blueUnlockDate.textContent = nextUnlock.toLocaleDateString('es-ES') + ' a las ' + nextUnlock.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}) + ` (${formatBalance(data.next_unlock_amount)} BLUE)`;
            elements.blueUnlockDate.style.color = '#10B981';
        } else if (escrow > 0) {
            elements.blueUnlockDate.textContent = "Pendiente de fecha";
            elements.blueUnlockDate.style.color = '#f59e0b';
        } else {
            elements.blueUnlockDate.textContent = "Sin saldo bloqueado actualmente";
            elements.blueUnlockDate.style.color = '#94a3b8';
        }

        // 3. Crédito y Deuda RED
        const debt = parseFloat(data.red_balance) || 0;
        // Obtenemos el límite real calculado del usuario
        const creditLimit = data.credit_limit || 0;
        const availableCredit = Math.max(0, creditLimit - debt);
        
        elements.redCreditLimit.textContent = `${formatBalance(creditLimit)} RED`;
        if (elements.redCreditAvailable) {
            elements.redCreditAvailable.textContent = `${formatBalance(availableCredit)} RED`;
        }
        elements.redDebtTotal.textContent = `${formatBalance(debt)} RED`;

        if (debt > 0) {
            const due30 = parseFloat(data.debt_30_days) || 0;
            const dueEndMonth = parseFloat(data.debt_end_month) || 0;
            elements.redDebt30Days.textContent = `${formatBalance(due30)} RED`;
            elements.redDebtEndMonth.textContent = `${formatBalance(dueEndMonth)} RED`;
            
            if (data.next_due_at) {
                const nextDue = new Date(data.next_due_at);
                elements.redNextDueDate.textContent = nextDue.toLocaleDateString('es-ES') + ` (${formatBalance(data.next_due_amount)} RED)`;
                elements.redNextDueDate.style.color = '#ef4444';
            } else {
                elements.redNextDueDate.textContent = "Pendiente de registro";
            }
        } else {
            elements.redDebt30Days.textContent = `0.0000 RED`;
            elements.redDebtEndMonth.textContent = `0.0000 RED`;
            elements.redNextDueDate.textContent = "Excelente: Sin deudas próximas";
            elements.redNextDueDate.style.color = '#10B981';
        }

        // 4. Estadísticas de Actividad (Reales desde historial)
        const txResponse = await fetch(`${API_URL}/api/me/transactions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        let txData = [];
        if (txResponse.ok) {
            txData = await txResponse.json();
            
            // Generar tabla de historial
            if (txData.length === 0) {
                elements.txHistoryContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 10px;">Aún no tienes actividades registradas.</div>';
            } else {
                let html = '<table style="width: 100%; border-collapse: collapse; text-align: left;">';
                txData.slice(0, 15).forEach(tx => {
                    const amountBlue = parseFloat(tx.blue_change) || 0;
                    const amountRed = parseFloat(tx.red_change) || 0;
                    let displayAmount = '';
                    let color = '#f8fafc';
                    
                    if (amountBlue !== 0) {
                        displayAmount = `${amountBlue > 0 ? '+' : ''}${formatBalance(amountBlue)} BLUE`;
                        color = amountBlue > 0 ? '#10B981' : '#f8fafc';
                    } else if (amountRed !== 0) {
                        displayAmount = `${amountRed > 0 ? '+' : ''}${formatBalance(amountRed)} RED`;
                        color = amountRed > 0 ? '#ef4444' : '#10B981'; // Rojo si la deuda sube, verde si baja (pago)
                    } else {
                        displayAmount = '-';
                    }

                    let txHashHtml = '';
                    if (tx.tx_hash) {
                        txHashHtml = `<br><a href="https://sepolia-optimism.etherscan.io/tx/${tx.tx_hash}" target="_blank" style="color: #3b82f6; font-size: 0.75rem; text-decoration: none;">Ver en Explorer ↗</a>`;
                    }

                    html += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 8px 0; color: #94a3b8;">${new Date(tx.created_at).toLocaleDateString('es-ES')}</td>
                            <td style="padding: 8px 0;">${tx.description || tx.type}${txHashHtml}</td>
                            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${color};">${displayAmount}</td>
                        </tr>
                    `;
                });
                html += '</table>';
                elements.txHistoryContainer.innerHTML = html;
            }
        }

        // Calcular stats
        elements.statInteractions.textContent = txData.length;
        elements.statReceived.textContent = txData.filter(t => t.type === 'payment_received' || t.type === 'booster_reward').length;
        elements.statSent.textContent = txData.filter(t => t.type === 'payment_sent').length;
        elements.statBurned.textContent = txData.filter(t => t.type === 'burn' || (t.type === 'payment_sent' && parseFloat(t.red_change) < 0)).length;

        // 5. Link del Explorador
        if (isValidAddress) {
            elements.explorerLinkBtn.href = `https://sepolia-optimism.etherscan.io/address/${address}`;
        } else {
            elements.explorerLinkBtn.href = "#";
            elements.explorerLinkBtn.style.opacity = '0.5';
            elements.explorerLinkBtn.style.cursor = 'not-allowed';
            elements.explorerLinkBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                Auditar en Explorador (No disponible)
            `;
            elements.explorerLinkBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showCustomAlert("Aún no tienes una billetera asignada en la red para auditar.");
            });
        }

        // 6. Lógica de Modales de Smart Contract
        async function openSCModal(type) {
            // Mostrar modal con estado de carga
            elements.scModalTitle.textContent = type === 'blue' ? 'WintonCoin BLUE (IOU) Contract' : 'WintonCoin RED (Deuda) Contract';
            elements.scModalAddress.textContent = 'Cargando...';
            elements.scModalMinted.textContent = 'Consultando Blockchain...';
            elements.scModalExplorer.style.display = 'none';
            elements.scModal.style.display = 'block';

            try {
                const infoResponse = await fetch(`${API_URL}/api/contracts/info`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!infoResponse.ok) throw new Error('Error fetching contract info');
                
                const contractData = await infoResponse.json();
                const data = contractData[type];
                
                elements.scModalAddress.textContent = data.address;
                elements.scModalMinted.textContent = data.minted;
                elements.scModalExplorer.href = `https://sepolia-optimism.etherscan.io/address/${data.address}`;
                elements.scModalExplorer.style.display = 'flex';
                
            } catch (error) {
                console.error('Error cargando datos del contrato:', error);
                elements.scModalAddress.textContent = 'Error de conexión RPC';
                elements.scModalMinted.textContent = 'No disponible temporalmente';
            }
        }

        elements.scBlueBtn.addEventListener('click', () => openSCModal('blue'));
        elements.scRedBtn.addEventListener('click', () => openSCModal('red'));

        elements.scModalClose.addEventListener('click', () => {
            elements.scModal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === elements.scModal) {
                elements.scModal.style.display = 'none';
            }
        });

        // Ocultar loading y mostrar contenido con fade in
        elements.loading.style.display = 'none';
        elements.content.style.animation = 'fadeIn 0.5s ease forwards';
        elements.content.style.display = 'block';

    } catch (error) {
        console.error("Estado Cuenta Error: ", error);
        elements.loading.style.display = 'none';
        showCustomAlert('Hubo un problema al cargar el estado de cuenta. Intenta nuevamente o contacta a soporte.');
    }
}

document.addEventListener('DOMContentLoaded', initializeEstadoCuenta);
