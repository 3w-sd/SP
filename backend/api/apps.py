from django.apps import AppConfig


class ApiConfig(AppConfig):
    # Set the default primary key type for consistency
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'
    verbose_name = 'Smart Portal API'
