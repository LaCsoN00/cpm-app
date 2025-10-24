import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { role: true, id: true }
    })

    if (!dbUser || dbUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    // Prevent admin from deleting themselves
    if (userId === dbUser.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Delete associated data first (tasks, projects, etc.)
    // Delete tasks assigned to the user
    await prisma.task.deleteMany({
      where: { userId }
    })

    // Delete projects created by the user
    await prisma.project.deleteMany({
      where: { createdById: userId }
    })

    // Delete project associations
    await prisma.projectUser.deleteMany({
      where: { userId }
    })

    // Finally, delete the user
    await prisma.user.delete({
      where: { id: userId }
    })

    // Also delete from Supabase auth if possible
    // Note: In production, you might want to delete the Supabase auth user too
    // This requires the Supabase service role key
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify if user is admin
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { role: true, id: true }
    })

    if (!dbUser || dbUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId, restricted } = await request.json()

    if (!userId || typeof restricted !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    // Prevent admin from restricting themselves
    if (userId === dbUser.id) {
      return NextResponse.json({ error: 'Cannot restrict your own account' }, { status: 400 })
    }

    // Verify user exists before updating
    const userExists = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update restricted status
    await prisma.user.update({
      where: { id: userId },
      data: { restricted }
    })

    const action = restricted ? 'restricted' : 'unrestricted'
    return NextResponse.json({ success: true, message: `User ${action} successfully` }, { status: 200 })
  } catch (error) {
    console.error('Error updating user restriction:', error)
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
