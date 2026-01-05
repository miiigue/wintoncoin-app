
/**
 * This interface defines the API endpoints for the application using Retrofit.
 */
@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000(\n\u0002\u0018\u0002\n\u0002\u0010\u0000\n\u0000\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\bf\u0018\u00002\u00020\u0001J!\u0010\u0002\u001a\b\u0012\u0004\u0012\u00020\u00040\u00032\b\b\u0001\u0010\u0005\u001a\u00020\u0006H\u00a7@\u00f8\u0001\u0000\u00a2\u0006\u0002\u0010\u0007J!\u0010\b\u001a\b\u0012\u0004\u0012\u00020\t0\u00032\b\b\u0001\u0010\u0005\u001a\u00020\nH\u00a7@\u00f8\u0001\u0000\u00a2\u0006\u0002\u0010\u000b\u0082\u0002\u0004\n\u0002\b\u0019\u00a8\u0006\f"}, d2 = {"LWintonApi;", "", "login", "Lretrofit2/Response;", "Lcom/wintoncoin/app/data/model/LoginResponse;", "request", "Lcom/wintoncoin/app/data/model/LoginRequest;", "(Lcom/wintoncoin/app/data/model/LoginRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "register", "Ljava/lang/Void;", "Lcom/wintoncoin/app/data/model/RegisterRequest;", "(Lcom/wintoncoin/app/data/model/RegisterRequest;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "app_debug"})
public abstract interface WintonApi {
    
    /**
     * Sends a POST request to the "login" endpoint.
     * @param request The user's login credentials.
     * @return A Response containing the login result, including a token and user data.
     */
    @retrofit2.http.POST(value = "login")
    @org.jetbrains.annotations.Nullable
    public abstract java.lang.Object login(@retrofit2.http.Body
    @org.jetbrains.annotations.NotNull
    com.wintoncoin.app.data.model.LoginRequest request, @org.jetbrains.annotations.NotNull
    kotlin.coroutines.Continuation<? super retrofit2.Response<com.wintoncoin.app.data.model.LoginResponse>> $completion);
    
    /**
     * Sends a POST request to the "api/register-request" endpoint.
     * @param request The user's registration details.
     * @return A Response indicating success or failure, with no body content.
     */
    @retrofit2.http.POST(value = "api/register-request")
    @org.jetbrains.annotations.Nullable
    public abstract java.lang.Object register(@retrofit2.http.Body
    @org.jetbrains.annotations.NotNull
    com.wintoncoin.app.data.model.RegisterRequest request, @org.jetbrains.annotations.NotNull
    kotlin.coroutines.Continuation<? super retrofit2.Response<java.lang.Void>> $completion);
}