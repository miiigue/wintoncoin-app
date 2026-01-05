import androidx.privacysandbox.tools.core.generator.build
import dagger.Module

@Module
@InstallIn(SingletonComponent::class) // Scopes the providers to the application's lifetime
object AppModule {

    // IMPORTANT: Replace this with your actual backend server URL.
    // Use "http://10.0.2.2:PORT/" for a local server on the same machine as the emulator.
    private const val BASE_URL = "http://YOUR_API_BASE_URL/"

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        // This is useful for debugging to see network request and response logs
        val logging = HttpLoggingInterceptor()
        logging.setLevel(HttpLoggingInterceptor.Level.BODY)

        return OkHttpClient.Builder()
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideWintonApi(retrofit: Retrofit): WintonApi {
        // This function tells Hilt how to create an instance of WintonApi
        return retrofit.create(WintonApi::class.java)
    }
}