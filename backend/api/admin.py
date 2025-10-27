# File: backend/api/admin.py
from django.contrib import admin
from .models import User, Department, Course, Enrollment, Attendance, Lecture 

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_staff', 'master_pin') # Added master_pin
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)
    # Allow admin to set master_pin
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
        ('Master PIN (Admin Only)', {'fields': ('master_pin',)}),
    )
    # Make password readonly in admin change view
    readonly_fields = ('last_login', 'date_joined') 

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'created_at')
    search_fields = ('name', 'code')

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department', 'instructor', 'capacity', 'seats_left')
    list_filter = ('department', 'instructor', 'credits')
    search_fields = ('code', 'name', 'instructor__email')
    
    # Remove location fields from Course admin as they moved to Lecture
    fieldsets = (
        (None, {
            'fields': (('name', 'code'), 'description', ('department', 'instructor'), ('start_date', 'end_date'), ('credits', 'capacity'))
        }),
    )
    
    def seats_left(self, obj):
        return obj.seats_left()
    seats_left.short_description = 'Seats Left'

@admin.register(Lecture)
class LectureAdmin(admin.ModelAdmin):
    list_display = ('course', 'scheduled_date', 'start_time', 'end_time', 'timezone', 'attendance_pin', 'is_pin_active') # Added timezone
    list_filter = ('course', 'scheduled_date', 'timezone') # Added timezone
    search_fields = ('course__code',)
    readonly_fields = ('pin_generated_at', 'attendance_pin', 'is_pin_active')
    
    # Organize fields in the admin form
    fieldsets = (
        (None, {
            'fields': ('course', ('scheduled_date', 'start_time', 'end_time'), 'timezone')
        }),
        ('Location & Radius', {
            'fields': (('location_lat', 'location_lon'), 'attendance_radius')
        }),
        ('Attendance PIN (Read Only)', {
            'classes': ('collapse',), # Make collapsible
            'fields': ('attendance_pin', 'pin_generated_at', 'is_pin_active')
        }),
    )
    
    def is_pin_active(self, obj):
        return obj.is_pin_active()
    is_pin_active.boolean = True
    is_pin_active.short_description = 'PIN Active'

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'status', 'grade', 'enrollment_date')
    list_filter = ('status', 'course__department', 'course')
    search_fields = ('student__email', 'course__name', 'course__code')

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('student', 'course', 'lecture', 'timestamp', 'status', 'latitude', 'longitude')
    list_filter = ('status', 'course', 'lecture__scheduled_date') # Added lecture date filter
    search_fields = ('student__email', 'course__code', 'lecture__scheduled_date')