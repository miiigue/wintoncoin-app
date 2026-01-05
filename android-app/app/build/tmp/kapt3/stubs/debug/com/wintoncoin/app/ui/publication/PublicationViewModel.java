package com.wintoncoin.app.ui.publication;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u00004\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\b\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0004\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000b\n\u0000\b\u0007\u0018\u00002\u00020\u0001B\u000f\b\u0007\u0012\u0006\u0010\u0002\u001a\u00020\u0003\u00a2\u0006\u0002\u0010\u0004J6\u0010\u000e\u001a\u00020\u000f2\u0006\u0010\u0010\u001a\u00020\u00112\u0006\u0010\u0012\u001a\u00020\u00112\u0006\u0010\u0013\u001a\u00020\u00112\u0006\u0010\u0014\u001a\u00020\u00112\u0006\u0010\u0015\u001a\u00020\u00162\u0006\u0010\u0017\u001a\u00020\u0018R\u000e\u0010\u0002\u001a\u00020\u0003X\u0082\u0004\u00a2\u0006\u0002\n\u0000R+\u0010\u0007\u001a\u00020\u00062\u0006\u0010\u0005\u001a\u00020\u00068F@BX\u0086\u008e\u0002\u00a2\u0006\u0012\n\u0004\b\f\u0010\r\u001a\u0004\b\b\u0010\t\"\u0004\b\n\u0010\u000b\u00a8\u0006\u0019"}, d2 = {"Lcom/wintoncoin/app/ui/publication/PublicationViewModel;", "Landroidx/lifecycle/ViewModel;", "repository", "Lcom/wintoncoin/app/data/repository/PublicationRepository;", "(Lcom/wintoncoin/app/data/repository/PublicationRepository;)V", "<set-?>", "Lcom/wintoncoin/app/ui/publication/PublicationUiState;", "uiState", "getUiState", "()Lcom/wintoncoin/app/ui/publication/PublicationUiState;", "setUiState", "(Lcom/wintoncoin/app/ui/publication/PublicationUiState;)V", "uiState$delegate", "Landroidx/compose/runtime/MutableState;", "createPublication", "", "type", "", "title", "description", "amount", "slots", "", "autoApprove", "", "app_debug"})
@dagger.hilt.android.lifecycle.HiltViewModel
public final class PublicationViewModel extends androidx.lifecycle.ViewModel {
    @org.jetbrains.annotations.NotNull
    private final com.wintoncoin.app.data.repository.PublicationRepository repository = null;
    @org.jetbrains.annotations.NotNull
    private final androidx.compose.runtime.MutableState uiState$delegate = null;
    
    @javax.inject.Inject
    public PublicationViewModel(@org.jetbrains.annotations.NotNull
    com.wintoncoin.app.data.repository.PublicationRepository repository) {
        super();
    }
    
    @org.jetbrains.annotations.NotNull
    public final com.wintoncoin.app.ui.publication.PublicationUiState getUiState() {
        return null;
    }
    
    private final void setUiState(com.wintoncoin.app.ui.publication.PublicationUiState p0) {
    }
    
    public final void createPublication(@org.jetbrains.annotations.NotNull
    java.lang.String type, @org.jetbrains.annotations.NotNull
    java.lang.String title, @org.jetbrains.annotations.NotNull
    java.lang.String description, @org.jetbrains.annotations.NotNull
    java.lang.String amount, int slots, boolean autoApprove) {
    }
}