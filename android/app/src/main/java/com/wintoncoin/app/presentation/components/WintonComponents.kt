// ============================================================================
// WintonCoin Android — Componentes de UI Reutilizables
// ============================================================================
// Componentes UI estandarizados siguiendo el Design System de WintonCoin.
// Provee botones premium, campos de entrada con validación visual y modales de alerta.
// ============================================================================

package com.wintoncoin.app.presentation.components

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.wintoncoin.app.presentation.theme.WintonBlue
import com.wintoncoin.app.presentation.theme.WintonError

/**
 * WintonButton — Botón primario de acción con estado de carga (spinner).
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
            containerColor = WintonBlue,
            contentColor = Color.White
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
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}

/**
 * WintonTextField — Campo de entrada de texto estilizado con soporte para iconos,
 * placeholder, deshabilitado en carga y mensajes de error.
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
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label) },
            placeholder = placeholder?.let { { Text(it, color = Color.Gray) } },
            enabled = enabled,
            singleLine = true,
            isError = errorMessage != null,
            leadingIcon = leadingIcon?.let {
                { Icon(imageVector = it, contentDescription = label) }
            },
            trailingIcon = if (isPassword) {
                {
                    val image = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff
                    val description = if (passwordVisible) "Ocultar contraseña" else "Mostrar contraseña"
                    IconButton(onClick = { passwordVisible = !passwordVisible }, enabled = enabled) {
                        Icon(imageVector = image, contentDescription = description)
                    }
                }
            } else null,
            visualTransformation = if (isPassword && !passwordVisible) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = WintonBlue,
                unfocusedBorderColor = Color.LightGray,
                errorBorderColor = WintonError
            ),
            modifier = Modifier.fillMaxWidth()
        )

        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = errorMessage,
                color = WintonError,
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
    }
}

/**
 * WintonAlertDialog — Diálogo modal estandarizado.
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
                style = MaterialTheme.typography.titleLarge
            )
        },
        text = {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(confirmButtonText, color = WintonBlue)
            }
        },
        shape = RoundedCornerShape(16.dp)
    )
}
