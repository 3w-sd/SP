from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Department, Course

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

class DepartmentSerializer(serializers.ModelSerializer):
    """Serializer for Department model."""
    class Meta:
        model = Department
        fields = '__all__'

class CourseSerializer(serializers.ModelSerializer):
    """Serializer for Course model."""
    department_name = serializers.ReadOnlyField(source='department.name')
    lecturer_email = serializers.ReadOnlyField(source='lecturer.email')

    class Meta:
        model = Course
        fields = ['id', 'name', 'code', 'department', 'department_name', 'lecturer', 'lecturer_email']
