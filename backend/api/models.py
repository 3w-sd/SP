# File: backend/api/models.py
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.conf import settings
from django.db.models.functions import ExtractDay, ExtractMonth, ExtractYear # Needed for Meta constraint
from django.utils.timezone import now
from datetime import timedelta 
from django.utils import timezone 
import pytz # Import pytz

# --- Custom User Manager (Existing) ---
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
    
    # MASTER PIN FIELD (Admin can set this for themselves)
    master_pin = models.CharField(max_length=10, blank=True, null=True, help_text="Master PIN for universal attendance (Admin Only)")

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    def __str__(self):
        return self.email
    
    def save(self, *args, **kwargs):
        if self.role == 'ADMIN' or self.role == 'LECTURER':
            self.is_staff = True
        else:
            self.is_staff = False
        super().save(*args, **kwargs)

class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Course(models.Model):
    """Model for courses offered (Location fields REMOVED)."""
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, null=True)
    credits = models.IntegerField(default=3)
    
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='courses')
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
        enrolled_count = self.enrollments.filter(status='ENROLLED').count()
        return self.capacity - enrolled_count

    def is_full(self):
        return self.seats_left() <= 0

class Lecture(models.Model):
    """Represents a single scheduled class session with timezone."""
    
    # Timezone choices (add more as needed from pytz.all_timezones)
    TIMEZONE_CHOICES = [
        ('Africa/Cairo', 'Cairo (EET/EEST)'),
        ('Africa/Khartoum', 'Khartoum (CAT)'),
        ('UTC', 'UTC'), 
        # Add more relevant timezones if required
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='lectures')
    scheduled_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    # Location for this specific session
    location_lat = models.DecimalField(max_digits=9, decimal_places=6, help_text="Latitude for attendance check")
    location_lon = models.DecimalField(max_digits=9, decimal_places=6, help_text="Longitude for attendance check")
    attendance_radius = models.IntegerField(default=100, help_text="Allowed radius (meters)")
    
    # NEW: Timezone field for this lecture
    timezone = models.CharField(max_length=50, choices=TIMEZONE_CHOICES, default='Africa/Cairo')
    
    # PIN for QR/Manual Check (changes every 10 minutes)
    attendance_pin = models.CharField(max_length=6, blank=True, null=True)
    pin_generated_at = models.DateTimeField(auto_now_add=True) # Use auto_now_add initially
    
    class Meta:
        unique_together = ('course', 'scheduled_date', 'start_time')
        ordering = ['scheduled_date', 'start_time']
        
    def __str__(self):
        return f"{self.course.code} - {self.scheduled_date.strftime('%Y-%m-%d')} ({self.start_time.strftime('%H:%M')} {self.timezone})"
    
    def is_pin_active(self):
        """Checks if the current PIN is still valid (generated within the last 10 minutes)."""
        if not self.attendance_pin:
            return False
        # Compare timezone-aware datetime objects
        return (timezone.now() - self.pin_generated_at) < timedelta(minutes=10)

class Enrollment(models.Model):
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
        unique_together = ('student', 'course')

    def __str__(self):
        return f"{self.student.email} enrolled in {self.course.code}"

    def enroll(self):
        if self.status != 'ENROLLED':
            self.status = 'ENROLLED'
            self.save()

    def drop(self):
        if self.status != 'DROPPED':
            self.status = 'DROPPED'
            self.save()
    
    def complete(self, grade, letter):
        self.status = 'COMPLETED'
        self.grade = grade
        self.final_grade_letter = letter
        self.save()
        
# --- ATTENDANCE MODEL MODIFIED ---

class Attendance(models.Model):
    """Tracks attendance records (now linked to a specific Lecture)."""
    STATUS_CHOICES = (
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LATE', 'Late'),
    )

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        limit_choices_to={'role': 'STUDENT'},
        related_name='attendance_records'
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='course_attendance')
    lecture = models.ForeignKey('Lecture', on_delete=models.CASCADE, related_name='lecture_attendance') # NEW FK
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ABSENT')
    
    # Location data stored upon marking attendance
    latitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True) # Increased precision
    longitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True) # Increased precision
    
    class Meta:
        # A student can only mark attendance once per specific lecture session
        unique_together = ('student', 'lecture')
        ordering = ['-timestamp']
        
    def __str__(self):
        return f"{self.student.email} - {self.course.code} / {self.lecture.scheduled_date} ({self.status})"