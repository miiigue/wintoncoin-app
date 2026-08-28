// ============================================================================
// WintonCoin Android — Componentes de UI Reutilizables (Idénticos a PWA)
// ============================================================================
// Componentes UI estandarizados siguiendo el Design System de WintonCoin (style.css).
// ============================================================================

package com.wintoncoin.app.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wintoncoin.app.presentation.theme.WintonBorderSoft
import com.wintoncoin.app.presentation.theme.WintonError
import com.wintoncoin.app.presentation.theme.WintonInputBg
import com.wintoncoin.app.presentation.theme.WintonPrimary
import com.wintoncoin.app.presentation.theme.WintonSurfaceDark
import com.wintoncoin.app.presentation.theme.WintonTextMuted
import com.wintoncoin.app.presentation.theme.WintonTextWhite

/**
 * WintonButton — Botón primario de acción estilizado con gradiente de la PWA.
 */
@Composable
fun WintonButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        enabled = enabled && !isLoading,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = WintonPrimary, // #6A5ACD
            contentColor = Color.White,
            disabledContainerColor = WintonPrimary.copy(alpha = 0.5f),
            disabledContentColor = Color.White.copy(alpha = 0.5f)
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = Color.White,
                strokeWidth = 2.5.dp
            )
        } else {
            Text(
                text = text,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
        }
    }
}

/**
 * WintonTextField — Campo de entrada de texto con estilo PWA: fondo oscuro, borde fino y label arriba.
 */
@Composable
fun WintonTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    leadingIcon: ImageVector? = null,
    isPassword: Boolean = false,
    errorMessage: String? = null,
    enabled: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default
) {
    var passwordVisible by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            color = WintonTextMuted,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(bottom = 6.dp)
        )

        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = placeholder?.let { { Text(it, color = WintonTextMuted.copy(alpha = 0.6f), fontSize = 14.sp) } },
            enabled = enabled,
            singleLine = true,
            isError = errorMessage != null,
            leadingIcon = leadingIcon?.let {
                { Icon(imageVector = it, contentDescription = label, tint = WintonTextMuted) }
            },
            trailingIcon = if (isPassword) {
                {
                    val image = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff
                    val description = if (passwordVisible) "Ocultar contraseña" else "Mostrar contraseña"
                    IconButton(onClick = { passwordVisible = !passwordVisible }, enabled = enabled) {
                        Icon(imageVector = image, contentDescription = description, tint = WintonTextMuted)
                    }
                }
            } else null,
            visualTransformation = if (isPassword && !passwordVisible) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = WintonInputBg,
                unfocusedContainerColor = WintonInputBg,
                disabledContainerColor = WintonInputBg.copy(alpha = 0.5f),
                focusedBorderColor = WintonPrimary,
                unfocusedBorderColor = WintonBorderSoft,
                errorBorderColor = WintonError,
                focusedTextColor = WintonTextWhite,
                unfocusedTextColor = WintonTextWhite,
                cursorColor = WintonPrimary
            ),
            modifier = Modifier.fillMaxWidth()
        )

        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = errorMessage,
                color = WintonError,
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(start = 4.dp)
            )
        }
    }
}

/**
 * WintonAlertDialog — Diálogo modal estandarizado con estética PWA.
 */
@Composable
fun WintonAlertDialog(
    title: String,
    message: String,
    onDismissRequest: () -> Unit = {},
    onDismiss: () -> Unit = onDismissRequest,
    confirmButtonText: String = "Aceptar",
    onConfirm: () -> Unit = onDismiss
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = WintonTextWhite,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = WintonTextMuted,
                fontSize = 15.sp
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(confirmButtonText, color = WintonPrimary, fontWeight = FontWeight.Bold)
            }
        },
        containerColor = WintonSurfaceDark,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.border(1.dp, WintonBorderSoft, RoundedCornerShape(16.dp))
    )
}
