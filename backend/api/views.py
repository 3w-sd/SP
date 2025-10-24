# CODE TO PASTE INTO backend/api/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import (
    UserSerializer,
    DepartmentSerializer,
    CourseSerializer,
    CustomTokenObtainPairSerializer,
)
from .models import User, Department, Course
from rest_framework.views import APIView
from django.core.exceptions import ObjectDoesNotExist

# --- AUTHENTICATION VIEWS ---

class CustomTokenObtainPairView(TokenObtainPairView):
    """Overrides the default JWT view to use our custom serializer for extra user info."""
    serializer_class = CustomTokenObtainPairSerializer

class UserRegistrationView(generics.CreateAPIView):
    """Handles user registration (creation of User, Lecturer, or Admin)."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

class UserProfileView(generics.RetrieveAPIView):
    """
    Retrieves the profile of the currently authenticated user.
    Fixes the AssertionError by overriding get_object.
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        """Returns the user associated with the current request."""
        try:
            # request.user is available because of JWT authentication
            return self.request.user
        except ObjectDoesNotExist:
            return Response(
                {"detail": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            # Handle other potential exceptions
            return Response(
                {"detail": f"An error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

# --- CORE DATA VIEWS (Placeholders) ---

class DepartmentListCreateView(generics.ListCreateAPIView):
    """Admin-only view for listing/creating Departments."""
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    # Placeholder permission: only staff can manage departments
    permission_classes = [permissions.IsAdminUser] 

class CourseListCreateView(generics.ListCreateAPIView):
    """Admin-only view for listing/creating Courses."""
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAdminUser]

# This is the code you need to paste.

### Final Launch Confirmation

