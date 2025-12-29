package com.wintoncoin.app.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.wintoncoin.app.ui.theme.WintonBackground
import com.wintoncoin.app.ui.theme.WintonTextPrimary
import com.wintoncoin.app.ui.theme.WintonTextSecondary
import com.wintoncoin.app.ui.theme.WintonViolet

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WintonTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    trailingIcon: @Composable (() -> Unit)? = null,
    isError: Boolean = false
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = WintonViolet,
            unfocusedBorderColor = Color(0xFF2A3B5C), // Color del borde CSS
            focusedLabelColor = WintonViolet,
            unfocusedLabelColor = WintonTextSecondary,
            cursorColor = WintonViolet,
            focusedTextColor = WintonTextPrimary,
            unfocusedTextColor = WintonTextPrimary,
            containerColor = WintonBackground
        ),
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        trailingIcon = trailingIcon,
        isError = isError,
        singleLine = true
    )
}

