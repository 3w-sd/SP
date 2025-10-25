# File: backend/api/admin.py
from django.contrib import admin
from .models import User, Department, Course, Enrollment

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'created_at')
    search_fields = ('name', 'code')

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department', 'instructor', 'capacity', 'seats_left')
    list_filter = ('department', 'instructor', 'credits')
    search_fields = ('code', 'name', 'instructor__email')
    
    def seats_left(self, obj):
        return obj.seats_left()
    seats_left.short_description = 'Seats Left'

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'status', 'grade', 'enrollment_date')
    list_filter = ('status', 'course__department', 'course')
    search_fields = ('student__email', 'course__name', 'course__code')