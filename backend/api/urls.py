from django.urls import path
from .views import UserRegistrationView, CustomTokenObtainPairView, UserProfileView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
# Auth endpoints
path('register/', UserRegistrationView.as_view(), name='auth_register'),
path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

# User profile endpoint
path('profile/', UserProfileView.as_view(), name='user_profile'),


]