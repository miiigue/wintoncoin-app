package com.wintoncoin.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.wintoncoin.app.ui.theme.WintonSurface

@Composable
fun WintonCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = WintonSurface,
    borderColor: Color? = null,
    content: @Composable () -> Unit
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(15.dp), // Radius del CSS .container
        colors = CardDefaults.cardColors(
            containerColor = backgroundColor
        ),
        border = borderColor?.let { BorderStroke(1.dp, it) },
        elevation = CardDefaults.cardElevation(
            defaultElevation = 8.dp
        )
    ) {
        content()
    }
}

