# File: backend/api/serializers.py
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Department, Course, Enrollment

# --- JWT CUSTOM SERIALIZER ---

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Customizes the JWT token response to include the user's role and first/last name
    directly in the access token payload.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims to the token payload
        token['email'] = user.email
        token['role'] = user.role
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name

        return token

# --- CORE DATA SERIALIZERS ---

class UserSerializer(serializers.ModelSerializer):
    """Serializer for User registration and profile retrieval."""
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'password']
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        # Use our custom User manager method to create a user securely
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name'),
            last_name=validated_data.get('last_name'),
            role=validated_data.get('role', 'STUDENT')
        )
        return user

# --- NEW SERIALIZERS FOR COURSE MODULE ---

class DepartmentSerializer(serializers.ModelSerializer):
    """Serializer for Department model."""
    class Meta:
        model = Department
        fields = '__all__'

class InstructorSimpleSerializer(serializers.ModelSerializer):
    """Simplified user serializer for embedding in Course responses."""
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email']

class CourseSerializer(serializers.ModelSerializer):
    """Serializer for listing/retrieving Courses (read-only)."""
    department = DepartmentSerializer(read_only=True)
    instructor = InstructorSimpleSerializer(read_only=True)
    seats_left = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'code', 'name', 'description', 'credits', 'department', 
            'instructor', 'start_date', 'end_date', 'capacity', 
            'seats_left', 'is_full'
        ]

class CourseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating Courses (write-only)."""
    class Meta:
        model = Course
        fields = [
            'code', 'name', 'description', 'credits', 'department', 
            'instructor', 'start_date', 'end_date', 'capacity'
        ]
        
    def validate_instructor(self, value):
        """Ensure the assigned instructor is a LECTURER."""
        if value and value.role != 'LECTURER':
            raise serializers.ValidationError("Instructor must have the role 'LECTURER'.")
        return value

class EnrollmentSerializer(serializers.ModelSerializer):
    """Serializer for listing/retrieving Enrollments."""
    student = InstructorSimpleSerializer(read_only=True) # Re-use simple serializer
    course = CourseSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = ['id', 'student', 'course', 'enrollment_date', 'status', 'grade', 'final_grade_letter']

class EnrollmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new Enrollment (Student action)."""
    # Student is set from request, not payload
    
    class Meta:
        model = Enrollment
        fields = ['course'] # Student only needs to provide the course ID

    def validate_course(self, course):
        """Check course capacity and prevent re-enrollment."""
        student = self.context['request'].user
        
        # 1. Check if already enrolled
        if Enrollment.objects.filter(student=student, course=course).exists():
            raise serializers.ValidationError("You are already enrolled in this course.")
            
        # 2. Check capacity
        if course.is_full():
            raise serializers.ValidationError("This course is full.")
            
        return course

    def create(self, validated_data):
        """Create the enrollment with the student from the request."""
        return Enrollment.objects.create(
            student=self.context['request'].user,
            course=validated_data['course'],
            status='ENROLLED'
        )