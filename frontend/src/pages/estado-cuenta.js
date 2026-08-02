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
        networkStatusDisplay: document.getElementById('networkStatusDisplay'),
        publicKeyLabel: document.getElementById('publicKeyLabel'),
        blueAvailable: document.getElementById('blueAvailable'),
        blueEscrow: document.getElementById('blueEscrow'),
        blueUnlockDate: document.getElementById('blueUnlockDate'),
        fiatEquivalency: document.getElementById('fiatEquivalency'),
        redCreditLimit: document.getElementById('redCreditLimit'),
        redCreditAvailable: document.getElementById('redCreditAvailable'),
        redDebtTotal: document.getElementById('redDebtTotal'),
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
        scModalExplorer: document.getElementById('scModalExplorer'),

        // Bóveda de Garantías (Collateral Vault)
        organicScore: document.getElementById('organicScore'),
        collateralDisplay: document.getElementById('collateralDisplay'),
        toggleVaultPanelBtn: document.getElementById('toggleVaultPanelBtn'),
        vaultPanel: document.getElementById('vaultPanel'),
        vaultTokenSelect: document.getElementById('vaultTokenSelect'),
        vaultAmountInput: document.getElementById('vaultAmountInput'),
        vaultTokenLabel: document.getElementById('vaultTokenLabel'),
        vaultNewLimit: document.getElementById('vaultNewLimit'),
        vaultDepositBtn: document.getElementById('vaultDepositBtn'),
        vaultWithdrawBtn: document.getElementById('vaultWithdrawBtn'),
        vaultStatus: document.getElementById('vaultStatus')
    };

    function formatBalance(val) {
        const num = Number(val) || 0;
        return num.toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    }

    try {
        // Obtener configuración de pre-lanzamiento de la plataforma de forma segura
        let preLaunchMode = false;
        try {
            const platformResponse = await fetch(`${API_URL}/api/platform-settings`);
            if (platformResponse.ok) {
                const platformData = await platformResponse.json();
                preLaunchMode = platformData.pre_launch_mode_enabled === true;
            }
        } catch (platformErr) {
            console.error("Error al obtener configuraciones de plataforma:", platformErr);
        }

        // De acuerdo con los estándares fintech, determinamos el entorno de ejecución del cliente.
        // Los cambios visuales restrictivos de la fase de pre-lanzamiento (enmascaramiento y ocultamiento)
        // solo deben aplicarse en el entorno de producción (MODE === 'production').
        // En los entornos de demostración (MODE === 'demo') y desarrollo se mantiene activa la blockchain testnet.
        const isProduction = import.meta.env.MODE === 'production';
        const applyPreLaunchUI = preLaunchMode && isProduction;

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
        
        if (applyPreLaunchUI) {
            // Enmascaramos la dirección pública de la billetera en pre-lanzamiento para evitar fugas de datos y confusión en el usuario
            elements.publicKey.textContent = 'xxxx....';
            // Si el elemento de etiqueta de la llave pública existe, actualizamos su descripción para reflejar el estado fuera de cadena
            if (elements.publicKeyLabel) {
                elements.publicKeyLabel.textContent = 'Llave pública (por asignar)';
            }
            // Actualizamos la etiqueta de estado de red para indicar de forma explícita que operamos en Off-Chain
            if (elements.networkStatusDisplay) {
                elements.networkStatusDisplay.textContent = 'Pre-lanzamiento (Off-Chain)';
                // Asignamos la clase highlight-blue para mantener una estética fintech premium acorde a la fase
                elements.networkStatusDisplay.className = 'data-value highlight-blue';
            }
            // Ocultamos el botón de copiado puesto que no existe una llave real en el portapapeles del usuario en esta etapa
            if (elements.copyBtn) {
                elements.copyBtn.style.display = 'none';
            }
            // Ocultamos el acceso al contrato inteligente BLUE on-chain para prevenir llamadas a contratos no desplegados
            if (elements.scBlueBtn) elements.scBlueBtn.style.display = 'none';
            // Ocultamos el acceso al contrato inteligente RED on-chain para asegurar un flujo puramente virtual en pre-lanzamiento
            if (elements.scRedBtn) elements.scRedBtn.style.display = 'none';
            // Ocultamos el botón del explorador de bloques porque no existen transacciones reales en el ledger público de testnet
            if (elements.explorerLinkBtn) elements.explorerLinkBtn.style.display = 'none';
        } else {
            // Si el modo pre-lanzamiento está inactivo, asignamos la dirección real del usuario si es válida, o el mensaje por defecto
            elements.publicKey.textContent = isValidAddress ? address : '0xPendienteDeAsignacion...';
        }

        // Recuperamos el contenedor visual del estado de verificación KYC del usuario
        const kycDisplay = document.getElementById('kycStatusDisplay');
        if (kycDisplay) {
            if (applyPreLaunchUI) {
                // En modo de pre-lanzamiento, el KYC on-chain no es mandatorio ni auditable directamente en blockchain
                // Forzamos un estado de 'Pendiente de Aprobación' para reflejar el estado administrativo off-chain
                kycDisplay.textContent = '⏳ Pendiente de Aprobación';
                kycDisplay.style.color = '#f59e0b'; // Usamos código de color ámbar para denotar estado transicional seguro
            } else if (!isValidAddress) {
                // Si la red está activa pero el usuario carece de billetera Web3, mostramos error de vinculación
                kycDisplay.textContent = '❌ Sin Billetera Web3';
                kycDisplay.style.color = '#ef4444'; // Color rojo de advertencia estándar
            } else if (data.kyc_verified) {
                // Si cuenta con dirección válida y está verificado, reflejamos su estado verificado en el ledger on-chain
                kycDisplay.textContent = '✅ Verificado On-Chain';
                kycDisplay.style.color = '#10B981'; // Color verde de éxito y conformidad
            } else {
                // Para cualquier otro caso, mantenemos el estado pendiente a la espera de la firma del KYC
                kycDisplay.textContent = '⏳ Pendiente de Aprobación';
                kycDisplay.style.color = '#f59e0b';
            }
        }
        
        // Registramos el listener de clic para copiar la dirección pública al portapapeles
        elements.copyBtn.addEventListener('click', () => {
            // Verificación de seguridad: abortamos de inmediato si no hay billetera válida o si estamos en fase de pre-lanzamiento
            if(!isValidAddress || applyPreLaunchUI) return;
            // Realizamos la escritura segura en el portapapeles del cliente usando el helper unificado
            copyTextToClipboard(address).then(() => {
                // Retroalimentación visual al usuario cambiando el texto temporalmente
                elements.copyBtn.textContent = 'Copiado ✓';
                elements.copyBtn.style.background = 'rgba(16, 185, 129, 0.4)';
                elements.copyBtn.style.color = '#fff';
                // Restauramos el estado del botón después de 2 segundos de manera asíncrona
                setTimeout(() => {
                    elements.copyBtn.textContent = 'Copiar';
                    elements.copyBtn.style.background = '';
                    elements.copyBtn.style.color = '';
                }, 2000);
            }).catch(err => {
                console.error('Error al copiar: ', err);
            });
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

        // 3. Crédito y Compromiso RED
        const debt = parseFloat(data.red_balance) || 0;
        // Obtenemos el límite real calculado del usuario
        const creditLimit = data.credit_limit || 0;
        const availableCredit = Math.max(0, creditLimit - debt);
        
        elements.redCreditLimit.textContent = `${formatBalance(creditLimit)} RED`;
        if (elements.redCreditAvailable) {
            elements.redCreditAvailable.textContent = `${formatBalance(availableCredit)} RED`;
        }
        elements.redDebtTotal.textContent = `${formatBalance(debt)} RED`;

        // 3b. Desglose del Límite RED (orgánico vs colateral)
        // collateralBalance proviene del backend (saldo neto depositado en la Bóveda)
        const collateralBalance = parseFloat(data.collateral_balance) || 0;
        // El score orgánico se calcula restando el colateral del límite total
        const organicScore = Math.max(0, creditLimit - collateralBalance);

        // Renderizar el desglose visual para auditoría UX
        if (elements.organicScore) {
            elements.organicScore.textContent = `${formatBalance(organicScore)} RED`;
        }
        if (elements.collateralDisplay) {
            elements.collateralDisplay.textContent = `+${formatBalance(collateralBalance)} RED`;
            // Si no hay colateral, mostramos en gris para indicar que puede aumentar
            elements.collateralDisplay.style.color = collateralBalance > 0 ? '#10B981' : '#64748b';
        }

        // ====================================================================
        // 3c. BÓVEDA DE GARANTÍAS (Collateral Vault - Interacción Web3)
        // ====================================================================
        // Direcciones de los contratos de Stablecoins en Optimism Sepolia (testnet)
        // IMPORTANTE: Estas direcciones deben actualizarse al migrar a mainnet
        const VAULT_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Reemplazar con dirección desplegada
        const TOKEN_ADDRESSES = {
            USDT: '0x0000000000000000000000000000000000000001', // TODO: Dirección real en Optimism Sepolia
            USDC: '0x0000000000000000000000000000000000000002', // TODO: Dirección real en Optimism Sepolia
            DAI:  '0x0000000000000000000000000000000000000003'  // TODO: Dirección real en Optimism Sepolia
        };

        // ABI mínimo del ERC20 (solo approve) para interactuar con MetaMask
        const ERC20_ABI = [
            'function approve(address spender, uint256 amount) external returns (bool)',
            'function allowance(address owner, address spender) external view returns (uint256)',
            'function balanceOf(address account) external view returns (uint256)'
        ];

        // ABI mínimo de la Bóveda (deposit, withdraw, getCollateralBalance)
        const VAULT_ABI = [
            'function deposit(uint256 amount) external',
            'function withdraw(uint256 amount) external',
            'function getCollateralBalance(address user) external view returns (uint256)'
        ];

        // Variable local para rastrear el límite actual durante la sesión
        let currentCreditLimit = creditLimit;

        // Toggle del panel expandible de la Bóveda
        if (elements.toggleVaultPanelBtn && elements.vaultPanel) {
            elements.toggleVaultPanelBtn.addEventListener('click', () => {
                const isHidden = elements.vaultPanel.style.display === 'none';
                elements.vaultPanel.style.display = isHidden ? 'block' : 'none';
                // Cambiar texto del botón según estado
                elements.toggleVaultPanelBtn.textContent = isHidden ? '✕ Cerrar Panel' : '⚡ Aumentar Límite RED';
            });
        }

        // Sincronizar la etiqueta del token cuando el usuario cambia el selector
        if (elements.vaultTokenSelect && elements.vaultTokenLabel) {
            elements.vaultTokenSelect.addEventListener('change', () => {
                elements.vaultTokenLabel.textContent = elements.vaultTokenSelect.value;
            });
        }

        // Calculadora en vivo: actualiza el nuevo límite al escribir el monto
        if (elements.vaultAmountInput && elements.vaultNewLimit) {
            elements.vaultAmountInput.addEventListener('input', () => {
                const inputVal = parseFloat(elements.vaultAmountInput.value) || 0;
                // El nuevo límite = límite actual + monto ingresado
                const newLimit = currentCreditLimit + inputVal;
                elements.vaultNewLimit.textContent = `${formatBalance(newLimit)} RED`;
            });
        }

        // Función auxiliar para mostrar el estado de la operación (éxito, error, cargando)
        function showVaultStatus(message, type) {
            if (!elements.vaultStatus) return;
            elements.vaultStatus.style.display = 'block';
            elements.vaultStatus.textContent = message;
            // Colores según tipo: success (verde), error (rojo), loading (azul)
            const colors = { success: '#10B981', error: '#ef4444', loading: '#3b82f6' };
            elements.vaultStatus.style.color = colors[type] || '#94a3b8';
            elements.vaultStatus.style.background = `${colors[type] || '#94a3b8'}15`;
        }

        // Función para sincronizar con el backend después de una operación exitosa
        async function syncCollateralWithBackend(operationType, amount, tokenSymbol, tokenAddress, txHash, balanceAfter) {
            try {
                const syncRes = await fetch(`${API_URL}/api/me/collateral/sync`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        operation_type: operationType,
                        amount: amount,
                        token_symbol: tokenSymbol,
                        token_contract_address: tokenAddress,
                        tx_hash: txHash,
                        balance_after: balanceAfter
                    })
                });

                if (handleSessionExpired(syncRes)) return null;

                const syncData = await syncRes.json();
                if (!syncRes.ok) {
                    throw new Error(syncData.message || 'Error al sincronizar con el backend');
                }

                // Actualizar el límite RED en la UI con el nuevo valor calculado
                if (syncData.new_credit_limit !== undefined) {
                    currentCreditLimit = syncData.new_credit_limit;
                    elements.redCreditLimit.textContent = `${formatBalance(currentCreditLimit)} RED`;
                    const newAvailable = Math.max(0, currentCreditLimit - debt);
                    if (elements.redCreditAvailable) {
                        elements.redCreditAvailable.textContent = `${formatBalance(newAvailable)} RED`;
                    }
                }

                return syncData;
            } catch (err) {
                console.error('[VAULT SYNC] Error:', err.message);
                throw err;
            }
        }

        // Handler del botón DEPOSITAR
        if (elements.vaultDepositBtn) {
            elements.vaultDepositBtn.addEventListener('click', async () => {
                // Validar que se haya ingresado un monto válido
                const amount = parseFloat(elements.vaultAmountInput?.value);
                if (!amount || amount <= 0) {
                    showVaultStatus('Ingresa un monto válido mayor a 0.', 'error');
                    return;
                }

                // Verificar que MetaMask esté disponible en el navegador
                if (typeof window.ethereum === 'undefined') {
                    showVaultStatus('Necesitas MetaMask instalado para depositar. Instálalo desde metamask.io', 'error');
                    return;
                }

                const selectedToken = elements.vaultTokenSelect?.value || 'USDT';
                const tokenAddress = TOKEN_ADDRESSES[selectedToken];

                try {
                    showVaultStatus('Conectando con MetaMask...', 'loading');

                    // Solicitar conexión de cuentas al usuario
                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                    const userAddress = accounts[0];

                    // Importar ethers dinámicamente (ya disponible en el bundle)
                    const { ethers } = await import('ethers');
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner();

                    // Convertir el monto a unidades del token (6 decimales para USDT/USDC, 18 para DAI)
                    const decimals = selectedToken === 'DAI' ? 18 : 6;
                    const amountInWei = ethers.parseUnits(amount.toString(), decimals);

                    // Paso 1: Aprobar al Vault para gastar los tokens del usuario
                    showVaultStatus(`Paso 1/2: Aprobando ${selectedToken} en MetaMask...`, 'loading');
                    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
                    const approveTx = await tokenContract.approve(VAULT_CONTRACT_ADDRESS, amountInWei);
                    await approveTx.wait(); // Esperar confirmación de la red

                    // Paso 2: Depositar en la Bóveda
                    showVaultStatus(`Paso 2/2: Depositando ${amount} ${selectedToken}...`, 'loading');
                    const vaultContract = new ethers.Contract(VAULT_CONTRACT_ADDRESS, VAULT_ABI, signer);
                    const depositTx = await vaultContract.deposit(amountInWei);
                    const receipt = await depositTx.wait(); // Esperar confirmación

                    // Consultar el nuevo saldo en la Bóveda para auditoría
                    const newBalance = await vaultContract.getCollateralBalance(userAddress);
                    const balanceAfter = parseFloat(ethers.formatUnits(newBalance, decimals));

                    // Paso 3: Sincronizar con el backend (registro inmutable + recálculo de Límite RED)
                    showVaultStatus('Registrando en el backend...', 'loading');
                    await syncCollateralWithBackend(
                        'deposit', amount, selectedToken, tokenAddress, receipt.hash, balanceAfter
                    );

                    showVaultStatus(`✅ Depósito de ${amount} ${selectedToken} exitoso. Tu Límite RED fue actualizado.`, 'success');

                    // Actualizar el desglose visual
                    const newCollateral = collateralBalance + amount;
                    if (elements.collateralDisplay) {
                        elements.collateralDisplay.textContent = `+${formatBalance(newCollateral)} RED`;
                        elements.collateralDisplay.style.color = '#10B981';
                    }

                    // Limpiar el input
                    if (elements.vaultAmountInput) elements.vaultAmountInput.value = '';
                    if (elements.vaultNewLimit) elements.vaultNewLimit.textContent = '--';

                } catch (err) {
                    console.error('[VAULT DEPOSIT] Error:', err);
                    // Distinguir entre rechazo del usuario y error de red
                    if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
                        showVaultStatus('Transacción cancelada por el usuario.', 'error');
                    } else {
                        showVaultStatus(`Error: ${err.reason || err.message || 'Error desconocido'}`, 'error');
                    }
                }
            });
        }

        // Handler del botón RETIRAR
        if (elements.vaultWithdrawBtn) {
            elements.vaultWithdrawBtn.addEventListener('click', async () => {
                // Validar que el usuario NO tenga deuda RED pendiente (Zero-Trust)
                if (debt > 0) {
                    showVaultStatus(`⛔ No puedes retirar garantía mientras tengas deuda RED pendiente (${formatBalance(debt)} RED). Paga tu compromiso primero.`, 'error');
                    return;
                }

                // Validar que el usuario tenga colateral para retirar
                if (collateralBalance <= 0) {
                    showVaultStatus('No tienes garantía depositada en la Bóveda.', 'error');
                    return;
                }

                // Validar monto a retirar
                const amount = parseFloat(elements.vaultAmountInput?.value);
                if (!amount || amount <= 0) {
                    showVaultStatus('Ingresa un monto válido para retirar.', 'error');
                    return;
                }

                if (amount > collateralBalance) {
                    showVaultStatus(`El monto excede tu garantía depositada (${formatBalance(collateralBalance)}).`, 'error');
                    return;
                }

                // Verificar MetaMask
                if (typeof window.ethereum === 'undefined') {
                    showVaultStatus('Necesitas MetaMask instalado para retirar.', 'error');
                    return;
                }

                const selectedToken = elements.vaultTokenSelect?.value || 'USDT';
                const tokenAddress = TOKEN_ADDRESSES[selectedToken];

                try {
                    showVaultStatus('Conectando con MetaMask...', 'loading');

                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                    const userAddress = accounts[0];

                    const { ethers } = await import('ethers');
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner();

                    const decimals = selectedToken === 'DAI' ? 18 : 6;
                    const amountInWei = ethers.parseUnits(amount.toString(), decimals);

                    // Ejecutar retiro en la Bóveda
                    showVaultStatus(`Retirando ${amount} ${selectedToken}...`, 'loading');
                    const vaultContract = new ethers.Contract(VAULT_CONTRACT_ADDRESS, VAULT_ABI, signer);
                    const withdrawTx = await vaultContract.withdraw(amountInWei);
                    const receipt = await withdrawTx.wait();

                    // Consultar nuevo saldo en la Bóveda
                    const newBalance = await vaultContract.getCollateralBalance(userAddress);
                    const balanceAfter = parseFloat(ethers.formatUnits(newBalance, decimals));

                    // Sincronizar con backend
                    showVaultStatus('Registrando retiro en el backend...', 'loading');
                    await syncCollateralWithBackend(
                        'withdraw', amount, selectedToken, tokenAddress, receipt.hash, balanceAfter
                    );

                    showVaultStatus(`✅ Retiro de ${amount} ${selectedToken} exitoso. Tu Límite RED fue actualizado.`, 'success');

                    // Actualizar desglose visual
                    const updatedCollateral = Math.max(0, collateralBalance - amount);
                    if (elements.collateralDisplay) {
                        elements.collateralDisplay.textContent = `+${formatBalance(updatedCollateral)} RED`;
                        elements.collateralDisplay.style.color = updatedCollateral > 0 ? '#10B981' : '#64748b';
                    }

                    // Limpiar input
                    if (elements.vaultAmountInput) elements.vaultAmountInput.value = '';
                    if (elements.vaultNewLimit) elements.vaultNewLimit.textContent = '--';

                } catch (err) {
                    console.error('[VAULT WITHDRAW] Error:', err);
                    if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
                        showVaultStatus('Transacción cancelada por el usuario.', 'error');
                    } else {
                        showVaultStatus(`Error: ${err.reason || err.message || 'Error desconocido'}`, 'error');
                    }
                }
            });
        }

        // En modo Pre-lanzamiento, ocultamos el botón de la Bóveda (no hay blockchain activa)
        if (applyPreLaunchUI) {
            if (elements.toggleVaultPanelBtn) elements.toggleVaultPanelBtn.style.display = 'none';
            const limitBreakdown = document.getElementById('limitBreakdown');
            if (limitBreakdown) limitBreakdown.style.display = 'none';
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
                        color = amountRed > 0 ? '#ef4444' : '#10B981'; // Rojo si el compromiso sube, verde si baja (amortización)
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
            elements.scModalTitle.textContent = type === 'blue' ? 'WintonCoin BLUE Token' : 'WintonCoin RED (Compromiso) Token';
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
