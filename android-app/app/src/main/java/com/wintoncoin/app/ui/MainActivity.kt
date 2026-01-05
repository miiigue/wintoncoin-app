import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.wintoncoin.app.util.BiometricPromptManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
// FIX: The class now correctly extends from ComponentActivity
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var biometricManager: BiometricPromptManager

    override fun onCreate(savedInstanceState: Bundle?) {
        // This line is crucial. Hilt performs its injections here.
        super.onCreate(savedInstanceState)

        // After super.onCreate(), you can use 'biometricManager'

        setContent {
            // Your Jetpack Compose UI code will go here.
            // For example:
            // AppTheme {
            //     YourNavHost()
            // }
        }
    }
}