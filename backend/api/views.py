# File: backend/api/views.py

from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .serializers import (
    UserSerializer,
    CustomTokenObtainPairSerializer,
    DepartmentSerializer,
    CourseSerializer,
    CourseCreateUpdateSerializer,
    EnrollmentSerializer,
    EnrollmentCreateSerializer,
)
from .models import User, Department, Course, Enrollment
from .permissions import IsAdmin, IsInstructor, IsStudent, IsInstructorOfCourse, IsStudentOwnerOfEnrollment

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
    """Retrieves the profile of the currently authenticated user."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        """Returns the user associated with the current request."""
        # request.user is available because of JWT authentication
        if not self.request.user.is_authenticated:
            raise permissions.NotAuthenticated()
        
        return self.request.user

# --- NEW: USER LIST VIEW FOR ADMIN ---

class UserListView(generics.ListAPIView):
    """
    List all users. Primarily used by Admin/Course creation forms to select instructors.
    Includes filtering for roles.
    """
    queryset = User.objects.all().order_by('last_name')
    serializer_class = UserSerializer
    # Only Admin should be able to see a list of all user data
    permission_classes = [IsAdmin] 
    filterset_fields = ['role'] # Allows filtering by /users/?role=LECTURER

# --- CORE DATA VIEWSETS ---

class DepartmentViewSet(viewsets.ModelViewSet):
    """API endpoints for Departments."""
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    
    def get_permissions(self):
        """Admins can do anything, others can only read."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.permission_classes = [IsAdmin]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

class CourseViewSet(viewsets.ModelViewSet):
    """API endpoints for Courses."""
    queryset = Course.objects.all().select_related('department', 'instructor').prefetch_related('enrollments')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['department', 'instructor', 'credits']
    search_fields = ['name', 'code']

    def get_serializer_class(self):
        """Use different serializers for read vs. write operations."""
        if self.action in ['create', 'update', 'partial_update']:
            return CourseCreateUpdateSerializer
        return CourseSerializer

    def get_permissions(self):
        """
        - Admins can do anything.
        - Instructors can create courses.
        - Instructors can only update/delete *their own* courses.
        - Students/Authenticated users can only read.
        """
        if self.action == 'create':
            self.permission_classes = [IsAdmin | IsInstructor]
        elif self.action in ['update', 'partial_update', 'destroy']:
            # Must be Admin OR (Instructor AND owner of the course)
            self.permission_classes = [IsAdmin | (IsInstructor & IsInstructorOfCourse)]
        elif self.action == 'students':
            # Custom action: Admin OR (Instructor AND owner)
            self.permission_classes = [IsAdmin | (IsInstructor & IsInstructorOfCourse)]
        else:
            # list, retrieve
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()
        
    def perform_create(self, serializer):
        """Automatically set instructor to current user if they are an instructor."""
        if self.request.user.role == 'LECTURER' and not serializer.validated_data.get('instructor'):
            serializer.save(instructor=self.request.user)
        else:
            serializer.save()

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        """Custom action to list students enrolled in a specific course."""
        course = self.get_object()
        enrollments = Enrollment.objects.filter(course=course, status__in=['ENROLLED', 'COMPLETED']).select_related('student')
        serializer = EnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)

class EnrollmentViewSet(viewsets.ModelViewSet):
    """
    API endpoints for Enrollments.
    """
    queryset = Enrollment.objects.all().select_related('student', 'course')

    def get_serializer_class(self):
        """Use create serializer for 'create' action."""
        if self.action == 'create':
            return EnrollmentCreateSerializer
        return EnrollmentSerializer
        
    def get_queryset(self):
        """Filter enrollments based on user role."""
        user = self.request.user
        if user.role == 'ADMIN':
            return Enrollment.objects.all().select_related('student', 'course', 'course__instructor')
        if user.role == 'LECTURER':
            # Return enrollments for courses taught by this instructor
            return Enrollment.objects.filter(course__instructor=user).select_related('student', 'course')
        if user.role == 'STUDENT':
            # Return enrollments for this student
            return Enrollment.objects.filter(student=user).select_related('student', 'course')
        return Enrollment.objects.none()

    def get_permissions(self):
        if self.action == 'create':
            self.permission_classes = [IsStudent]
        elif self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [IsStudentOwnerOfEnrollment]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    @action(detail=False, methods=['get'], url_path='my-courses')
    def my_courses(self, request):
        """A dedicated endpoint for students to view their enrollments."""
        if request.user.role != 'STUDENT':
            return Response(
                {"detail": "Only students can access this view."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        enrollments = Enrollment.objects.filter(student=request.user).select_related('course', 'course__department', 'course__instructor')
        serializer = self.get_serializer(enrollments, many=True)
        return Response(serializer.data)