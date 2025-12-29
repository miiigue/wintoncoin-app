package com.wintoncoin.app.ui.publication

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.wintoncoin.app.ui.components.WintonButton
import com.wintoncoin.app.ui.components.WintonCard
import com.wintoncoin.app.ui.components.WintonTextField
import com.wintoncoin.app.ui.theme.WintonBackground
import com.wintoncoin.app.ui.theme.WintonTextSecondary
import com.wintoncoin.app.ui.theme.WintonViolet

@Composable
fun CreatePublicationScreen(
    onNavigateBack: () -> Unit,
    viewModel: PublicationViewModel = hiltViewModel()
) {
    val uiState = viewModel.uiState
    val scrollState = rememberScrollState()

    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var slots by remember { mutableStateOf("1") }
    var autoApprove by remember { mutableStateOf(false) }
    var selectedType by remember { mutableStateOf("request") } // 'request', 'sell', 'donation'

    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            onNavigateBack() // Vuelve al Dashboard al terminar
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WintonBackground)
            .verticalScroll(scrollState)
            .padding(24.dp)
    ) {
        Text(
            "Crear Nueva Publicación",
            style = MaterialTheme.typography.headlineMedium,
            color = WintonViolet,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        // Selector de Tipo (Simplificado con Tabs o Botones)
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = selectedType == "request",
                onClick = { selectedType = "request" },
                label = { Text("Solicitud") }
            )
            FilterChip(
                selected = selectedType == "sell",
                onClick = { selectedType = "sell" },
                label = { Text("Venta") }
            )
            FilterChip(
                selected = selectedType == "donation",
                onClick = { selectedType = "donation" },
                label = { Text("Donación") }
            )
        }

        WintonTextField(
            value = title,
            onValueChange = { title = it },
            label = "Título"
        )
        
        Spacer(modifier = Modifier.height(16.dp))

        WintonTextField(
            value = description,
            onValueChange = { description = it },
            label = "Descripción",
            modifier = Modifier.height(120.dp) // Área más grande
        )

        Spacer(modifier = Modifier.height(16.dp))

        WintonTextField(
            value = amount,
            onValueChange = { amount = it },
            label = if (selectedType == "sell") "Precio (BLUE)" else "Recompensa (BLUE)"
        )

        Spacer(modifier = Modifier.height(16.dp))
        
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Cupos:", color = WintonTextSecondary, modifier = Modifier.weight(1f))
            WintonTextField(
                value = slots,
                onValueChange = { slots = it },
                label = "",
                modifier = Modifier.width(100.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Aprobación Automática", color = WintonTextSecondary, modifier = Modifier.weight(1f))
            Switch(
                checked = autoApprove,
                onCheckedChange = { autoApprove = it },
                colors = SwitchDefaults.colors(checkedThumbColor = WintonViolet)
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        if (uiState.error != null) {
            Text(
                text = uiState.error,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }

        WintonButton(
            text = "Publicar",
            onClick = {
                viewModel.createPublication(
                    type = selectedType,
                    title = title,
                    description = description,
                    amount = amount,
                    slots = slots.toIntOrNull() ?: 1,
                    autoApprove = autoApprove
                )
            },
            isLoading = uiState.isLoading
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        TextButton(
            onClick = onNavigateBack,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        ) {
            Text("Cancelar", color = WintonTextSecondary)
        }
    }
}

