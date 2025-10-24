from django.contrib import admin
from django.urls import path, include

urlpatterns = [
path('admin/', admin.site.urls),
# Include the URLs from our 'api' app
path('api/', include('api.urls')),
]