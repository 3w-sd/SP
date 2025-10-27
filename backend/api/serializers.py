# File: backend/api/serializers.py
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.db.models import Count
from django.utils import timezone
from .models import User, Department, Course, Enrollment, Attendance, Lecture
import pytz # Import pytz for timezone validation

# --- JWT CUSTOM SERIALIZER (Existing) ---
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Customizes the JWT token response."""
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role'] = user.role
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name
        return token

# --- CORE DATA SERIALIZERS (Defined First for Nesting) ---

class UserSerializer(serializers.ModelSerializer):
    """Serializer for User registration and profile retrieval."""
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'password', 'master_pin'] # Added master_pin
        extra_kwargs = {
            'password': {'write_only': True},
            'master_pin': {'write_only': True, 'required': False} # Master PIN is optional
        }

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name'),
            last_name=validated_data.get('last_name'),
            role=validated_data.get('role', 'STUDENT')
            # Master PIN is not set during creation via this serializer
        )
        return user

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

# --- COURSE SERIALIZERS ---

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
        # Removed location fields as they moved to Lecture
        fields = [
            'code', 'name', 'description', 'credits', 'department',
            'instructor', 'start_date', 'end_date', 'capacity'
        ]

    def validate_instructor(self, value):
        if value and value.role != 'LECTURER':
            raise serializers.ValidationError("Instructor must have the role 'LECTURER'.")
        return value

# --- NEW LECTURE SERIALIZERS ---

class LectureSerializer(serializers.ModelSerializer):
    """Read/Write serializer for Lecture scheduling (with timezone)."""
    instructor_email = serializers.ReadOnlyField(source='course.instructor.email')
    course_code = serializers.ReadOnlyField(source='course.code')
    is_pin_active = serializers.BooleanField(read_only=True)

    # Ensure timezone choices are validated against the model
    timezone = serializers.ChoiceField(choices=Lecture.TIMEZONE_CHOICES)

    class Meta:
        model = Lecture
        fields = '__all__'
        read_only_fields = ['attendance_pin', 'pin_generated_at']

# --- ENROLLMENT SERIALIZERS (Existing) ---

class EnrollmentSerializer(serializers.ModelSerializer):
    student = InstructorSimpleSerializer(read_only=True)
    course = CourseSerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = ['id', 'student', 'course', 'enrollment_date', 'status', 'grade', 'final_grade_letter']

class EnrollmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Enrollment
        fields = ['course']

    def validate_course(self, course):
        student = self.context['request'].user

        if Enrollment.objects.filter(student=student, course=course, status__in=['ENROLLED', 'PENDING']).exists():
            raise serializers.ValidationError("You are already enrolled in this course.")

        if course.is_full():
            raise serializers.ValidationError("This course is full.")

        return course

    def create(self, validated_data):
        return Enrollment.objects.create(
            student=self.context['request'].user,
            course=validated_data['course'],
            status='ENROLLED'
        )

# --- ATTENDANCE SERIALIZERS ---

class AttendanceSerializer(serializers.ModelSerializer):
    """Read-only serializer for attendance records (used for reports)."""
    student_name = serializers.SerializerMethodField()
    course_code = serializers.ReadOnlyField(source='course.code')
    lecture_date = serializers.ReadOnlyField(source='lecture.scheduled_date')

    class Meta:
        model = Attendance
        fields = [
            'id', 'course', 'course_code', 'lecture', 'lecture_date', 'student', 'student_name',
            'timestamp', 'status', 'latitude', 'longitude'
        ]

    def get_student_name(self, obj):
        return f"{obj.student.first_name} {obj.student.last_name}"

class AttendanceMarkSerializer(serializers.Serializer):
    """Serializer used by students to submit location/PIN."""
    lecture = serializers.PrimaryKeyRelatedField(queryset=Lecture.objects.all())
    # Increased precision AGAIN to max_digits=18, decimal_places=15
    latitude = serializers.DecimalField(max_digits=18, decimal_places=15, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=18, decimal_places=15, required=False, allow_null=True)
    attendance_pin = serializers.CharField(max_length=10, required=False, allow_null=True, allow_blank=True)

    def validate(self, data):
        """Custom validation to enforce uniqueness per lecture."""
        student = self.context['request'].user
        lecture = data['lecture']

        if Attendance.objects.filter(student=student, lecture=lecture).exists():
            raise serializers.ValidationError({"detail": "Attendance already marked for this lecture session."})

        # Ensure either PIN or Location is provided
        pin = data.get('attendance_pin', None)
        lat = data.get('latitude', None)
        lon = data.get('longitude', None)

        if pin == '': pin = None # Treat empty string as null

        is_pin_provided = pin is not None
        is_location_provided = lat is not None and lon is not None

        if not is_pin_provided and not is_location_provided:
             # Exception for Admin Master PIN - check if admin submitted master pin
             is_admin_master_pin = (student.role == 'ADMIN' and student.master_pin and student.master_pin == pin)
             if not is_admin_master_pin:
                 raise serializers.ValidationError({"detail": "Either Attendance PIN or Geolocation (Latitude/Longitude) must be provided."})

        return data


class ManualAttendanceSerializer(serializers.Serializer):
    """Serializer used by instructors for manual marking."""
    lecture = serializers.PrimaryKeyRelatedField(queryset=Lecture.objects.all())
    student = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(role='STUDENT'))
    status = serializers.ChoiceField(choices=['PRESENT', 'ABSENT', 'LATE'])

    def validate(self, data):
        student = data['student']
        lecture = data['lecture']

        if Attendance.objects.filter(student=student, lecture=lecture).exists():
            raise serializers.ValidationError(
                {"detail": f"Attendance for student {student.email} is already marked for this lecture."}
            )
        return data