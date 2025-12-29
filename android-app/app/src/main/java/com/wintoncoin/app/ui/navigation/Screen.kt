package com.wintoncoin.app.ui.navigation

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Register : Screen("register")
    object Dashboard : Screen("dashboard")
    object CreatePublication : Screen("create_publication")
}

