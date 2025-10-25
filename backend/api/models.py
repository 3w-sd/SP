# File: backend/api/models.py
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.core.exceptions import ValidationError
from django.conf import settings

# --- Custom User Manager ---

class CustomUserManager(BaseUserManager):
    """
    Custom manager for the User model where email is the unique identifier
    instead of usernames.
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'ADMIN')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)


# --- CORE MODELS ---

class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model with email as the unique identifier and role-based access.
    """
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('LECTURER', 'Lecturer'),
        ('STUDENT', 'Student'),
    )

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30, blank=True)
    last_name = models.CharField(max_length=30, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='STUDENT')
    
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    def __str__(self):
        return self.email
    
    # Overriding save to ensure correct staff status based on role
    def save(self, *args, **kwargs):
        if self.role == 'ADMIN' or self.role == 'LECTURER':
            self.is_staff = True
        else:
            self.is_staff = False
        super().save(*args, **kwargs)

class Department(models.Model):
    """Model for academic departments (e.g., Computer Science, Engineering)."""
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Course(models.Model):
    """Model for courses offered (e.g., CS101, Calculus)."""
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, null=True)
    credits = models.IntegerField(default=3)
    
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='courses')
    # Limit instructor choices to users with the 'LECTURER' role
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        limit_choices_to={'role': 'LECTURER'}, 
        related_name='teaching_courses'
    )
    
    start_date = models.DateField()
    end_date = models.DateField()
    capacity = models.IntegerField(default=30)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.code} - {self.name}"
    
    def seats_left(self):
        """Calculates remaining seats."""
        enrolled_count = self.enrollments.filter(status='ENROLLED').count()
        return self.capacity - enrolled_count

    def is_full(self):
        """Checks if the course has reached capacity."""
        return self.seats_left() <= 0

class Enrollment(models.Model):
    """Model connecting Students to Courses."""
    STATUS_CHOICES = (
        ('PENDING', 'Pending'),
        ('ENROLLED', 'Enrolled'),
        ('DROPPED', 'Dropped'),
        ('COMPLETED', 'Completed'),
    )
    
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        limit_choices_to={'role': 'STUDENT'}, 
        related_name='enrollments'
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='enrollments')
    enrollment_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ENROLLED')
    grade = models.FloatField(null=True, blank=True)
    final_grade_letter = models.CharField(max_length=2, null=True, blank=True)

    class Meta:
        # A student cannot enroll in the same course twice
        unique_together = ('student', 'course')

    def __str__(self):
        return f"{self.student.email} enrolled in {self.course.code}"

    def enroll(self):
        """Sets status to ENROLLED if not already."""
        if self.status != 'ENROLLED':
            self.status = 'ENROLLED'
            self.save()

    def drop(self):
        """Sets status to DROPPED."""
        if self.status != 'DROPPED':
            self.status = 'DROPPED'
            self.save()
    
    def complete(self, grade, letter):
        """Sets status to COMPLETED and assigns a grade."""
        self.status = 'COMPLETED'
        self.grade = grade
        self.final_grade_letter = letter
        self.save()